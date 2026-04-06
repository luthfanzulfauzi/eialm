const UINT32_MASK = BigInt("4294967295");
const BYTE_MASK = BigInt(255);
const ZERO = BigInt(0);
const ONE = BigInt(1);

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
