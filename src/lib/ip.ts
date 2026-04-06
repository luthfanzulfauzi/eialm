const UINT32_MASK = BigInt("4294967295");
const BYTE_MASK = BigInt(255);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const PRIVATE_RANGES = [
  {
    label: "10.0.0.0/8",
    start: parseIPv4Literal("10.0.0.0"),
    end: parseIPv4Literal("10.255.255.255"),
  },
  {
    label: "172.16.0.0/12",
    start: parseIPv4Literal("172.16.0.0"),
    end: parseIPv4Literal("172.31.255.255"),
  },
  {
    label: "192.168.0.0/16",
    start: parseIPv4Literal("192.168.0.0"),
    end: parseIPv4Literal("192.168.255.255"),
  },
] as const;

function parseIPv4Literal(value: string): bigint {
  const parts = value.split(".").map(Number);
  return (
    (BigInt(parts[0]) << BigInt(24)) |
    (BigInt(parts[1]) << BigInt(16)) |
    (BigInt(parts[2]) << BigInt(8)) |
    BigInt(parts[3])
  );
}

export function parseIPv4ToBigInt(value: string): bigint | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    return n;
  });
  if (nums.some((n) => n === null)) return null;
  const [a, b, c, d] = nums as number[];
  return (
    (BigInt(a) << BigInt(24)) |
    (BigInt(b) << BigInt(16)) |
    (BigInt(c) << BigInt(8)) |
    BigInt(d)
  );
}

export function formatBigIntToIPv4(value: bigint): string {
  const v = value & UINT32_MASK;
  const a = Number((v >> BigInt(24)) & BYTE_MASK);
  const b = Number((v >> BigInt(16)) & BYTE_MASK);
  const c = Number((v >> BigInt(8)) & BYTE_MASK);
  const d = Number(v & BYTE_MASK);
  return `${a}.${b}.${c}.${d}`;
}

export function compareIPv4Addresses(a: string, b: string): number {
  const aValue = parseIPv4ToBigInt(a);
  const bValue = parseIPv4ToBigInt(b);

  if (aValue === null && bValue === null) return a.localeCompare(b);
  if (aValue === null) return 1;
  if (bValue === null) return -1;
  if (aValue < bValue) return -1;
  if (aValue > bValue) return 1;
  return 0;
}

export function cidrToIPv4Range(cidrNetwork: string, prefix: number) {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const ip = parseIPv4ToBigInt(cidrNetwork);
  if (ip === null) return null;
  const hostBits = 32 - prefix;
  const size = ONE << BigInt(hostBits);
  const mask =
    prefix === 0 ? ZERO : (~(size - ONE) & UINT32_MASK);
  const start = ip & mask;
  const end = start + size - ONE;
  return { start, end, size };
}

export function isPrivateIPv4(value: string | bigint): boolean {
  const parsed = typeof value === "string" ? parseIPv4ToBigInt(value) : value;
  if (parsed === null) return false;

  return PRIVATE_RANGES.some((range) => parsed >= range.start && parsed <= range.end);
}

export function getPrivateRangeLabel(value: string | bigint): string | null {
  const parsed = typeof value === "string" ? parseIPv4ToBigInt(value) : value;
  if (parsed === null) return null;

  const match = PRIVATE_RANGES.find((range) => parsed >= range.start && parsed <= range.end);
  return match?.label ?? null;
}

export function expandIPv4CidrHosts(cidrNetwork: string, prefix: number, maxHosts = 1024) {
  const ip = parseIPv4ToBigInt(cidrNetwork);
  const range = cidrToIPv4Range(cidrNetwork, prefix);
  if (ip === null || range === null) return null;
  if (range.start !== ip) return null;
  if (range.size > BigInt(maxHosts)) return null;
  if (!isPrivateIPv4(range.start) || !isPrivateIPv4(range.end)) return null;

  const hosts: string[] = [];
  const hostStart = prefix <= 30 ? range.start + ONE : range.start;
  const hostEnd = prefix <= 30 ? range.end - ONE : range.end;

  if (hostStart > hostEnd) return [];

  for (let value = hostStart; value <= hostEnd; value++) {
    hosts.push(formatBigIntToIPv4(value));
  }

  return hosts;
}
