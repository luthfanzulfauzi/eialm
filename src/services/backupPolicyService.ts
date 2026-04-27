import { BackupFrequencyUnit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BackupManager } from "@/lib/backupManager";
import { writeAuditLog } from "@/lib/audit";

const BACKUP_POLICY_ID = "default";

type BackupPolicyInput = {
  enabled: boolean;
  retentionCount: number;
  frequencyUnit: BackupFrequencyUnit;
  frequencyInterval: number;
  timeZone: string;
  runHour: number;
  runMinute: number;
  dayOfMonth: number;
};

type TimeZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const getDaysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const getTimeZoneParts = (date: Date, timeZone: string): TimeZoneDateParts => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
};

const shiftLocalParts = (
  parts: Omit<TimeZoneDateParts, "second">,
  changes: { months?: number; days?: number; hours?: number }
) => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0));
  if (changes.months) date.setUTCMonth(date.getUTCMonth() + changes.months);
  if (changes.days) date.setUTCDate(date.getUTCDate() + changes.days);
  if (changes.hours) date.setUTCHours(date.getUTCHours() + changes.hours);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
};

const zonedLocalToUtc = (parts: Omit<TimeZoneDateParts, "second">, timeZone: string) => {
  let guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);

  for (let i = 0; i < 4; i++) {
    const actual = getTimeZoneParts(new Date(guess), timeZone);
    const desiredAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, 0);
    const diff = desiredAsUtc - actualAsUtc;
    if (diff === 0) break;
    guess += diff;
  }

  return new Date(guess);
};

const withClampedDay = (year: number, monthIndex: number, dayOfMonth: number, hour: number, minute: number) => {
  const maxDay = getDaysInMonth(year, monthIndex);
  return {
    year,
    month: monthIndex + 1,
    day: Math.min(dayOfMonth, maxDay),
    hour,
    minute,
  };
};

const computeNextRunAt = (now: Date, input: BackupPolicyInput) => {
  if (!input.enabled) {
    return null;
  }

  const nowLocal = getTimeZoneParts(now, input.timeZone);

  if (input.frequencyUnit === BackupFrequencyUnit.HOURLY) {
    let candidateLocal = {
      year: nowLocal.year,
      month: nowLocal.month,
      day: nowLocal.day,
      hour: nowLocal.hour,
      minute: input.runMinute,
    };
    let candidate = zonedLocalToUtc(candidateLocal, input.timeZone);
    if (candidate <= now) {
      candidateLocal = shiftLocalParts(candidateLocal, { hours: input.frequencyInterval });
      candidate = zonedLocalToUtc(candidateLocal, input.timeZone);
    }
    return candidate;
  }

  if (input.frequencyUnit === BackupFrequencyUnit.DAILY) {
    let candidateLocal = {
      year: nowLocal.year,
      month: nowLocal.month,
      day: nowLocal.day,
      hour: input.runHour,
      minute: input.runMinute,
    };
    let candidate = zonedLocalToUtc(candidateLocal, input.timeZone);
    if (candidate <= now) {
      candidateLocal = shiftLocalParts(candidateLocal, { days: input.frequencyInterval });
      candidate = zonedLocalToUtc(candidateLocal, input.timeZone);
    }
    return candidate;
  }

  const currentMonthCandidate = withClampedDay(
    nowLocal.year,
    nowLocal.month - 1,
    input.dayOfMonth,
    input.runHour,
    input.runMinute
  );

  const currentMonthCandidateUtc = zonedLocalToUtc(currentMonthCandidate, input.timeZone);

  if (currentMonthCandidateUtc > now) {
    return currentMonthCandidateUtc;
  }

  return zonedLocalToUtc(
    withClampedDay(
    nowLocal.year,
    nowLocal.month - 1 + input.frequencyInterval,
    input.dayOfMonth,
    input.runHour,
    input.runMinute
    ),
    input.timeZone
  );
};

const normalizePolicy = (policy: {
  enabled: boolean;
  retentionCount: number;
  frequencyUnit: BackupFrequencyUnit;
  frequencyInterval: number;
  timeZone: string;
  runHour: number;
  runMinute: number;
  dayOfMonth: number;
}) => {
  if (!Number.isInteger(policy.retentionCount) || policy.retentionCount < 1 || policy.retentionCount > 365) {
    throw new Error("Retention count must be between 1 and 365.");
  }
  if (!Number.isInteger(policy.frequencyInterval) || policy.frequencyInterval < 1 || policy.frequencyInterval > 365) {
    throw new Error("Frequency interval must be between 1 and 365.");
  }
  if (!Number.isInteger(policy.runHour) || policy.runHour < 0 || policy.runHour > 23) {
    throw new Error("Run hour must be between 0 and 23.");
  }
  if (!Number.isInteger(policy.runMinute) || policy.runMinute < 0 || policy.runMinute > 59) {
    throw new Error("Run minute must be between 0 and 59.");
  }
  if (!Number.isInteger(policy.dayOfMonth) || policy.dayOfMonth < 1 || policy.dayOfMonth > 31) {
    throw new Error("Day of month must be between 1 and 31.");
  }
  if (typeof policy.timeZone !== "string" || !policy.timeZone.trim()) {
    throw new Error("Time zone is required.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: policy.timeZone });
  } catch {
    throw new Error("Invalid time zone.");
  }
  return policy;
};

export const BackupPolicyService = {
  async getPolicy() {
    return prisma.backupPolicy.upsert({
      where: { id: BACKUP_POLICY_ID },
      update: {},
      create: { id: BACKUP_POLICY_ID },
    });
  },

  async updatePolicy(input: BackupPolicyInput, userId: string) {
    const normalized = normalizePolicy(input);
    const nextRunAt = computeNextRunAt(new Date(), normalized);

    const policy = await prisma.backupPolicy.upsert({
      where: { id: BACKUP_POLICY_ID },
      update: {
        ...normalized,
        nextRunAt,
      },
      create: {
        id: BACKUP_POLICY_ID,
        ...normalized,
        nextRunAt,
      },
    });

    await writeAuditLog({
      action: "BACKUP_POLICY_UPDATE",
      userId,
      details: {
        enabled: policy.enabled,
        retentionCount: policy.retentionCount,
        frequencyUnit: policy.frequencyUnit,
        frequencyInterval: policy.frequencyInterval,
        timeZone: policy.timeZone,
        runHour: policy.runHour,
        runMinute: policy.runMinute,
        dayOfMonth: policy.dayOfMonth,
        nextRunAt: policy.nextRunAt?.toISOString() ?? null,
      },
    });

    return policy;
  },

  async runDueBackupIfNeeded() {
    const policy = await this.getPolicy();
    if (!policy.enabled || !policy.nextRunAt) {
      return null;
    }

    const now = new Date();
    if (policy.nextRunAt > now) {
      return null;
    }

    const backup = await BackupManager.createBackup({ retentionCount: policy.retentionCount });
    const nextRunAt = computeNextRunAt(now, {
      enabled: policy.enabled,
      retentionCount: policy.retentionCount,
      frequencyUnit: policy.frequencyUnit,
      frequencyInterval: policy.frequencyInterval,
      timeZone: policy.timeZone,
      runHour: policy.runHour,
      runMinute: policy.runMinute,
      dayOfMonth: policy.dayOfMonth,
    });

    const updated = await prisma.backupPolicy.update({
      where: { id: BACKUP_POLICY_ID },
      data: {
        lastRunAt: now,
        nextRunAt,
      },
    });

    return {
      backup,
      policy: updated,
    };
  },
};
