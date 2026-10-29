/**
 * Reads a secret env var and strips an accidental "NAME=" prefix, quotes and whitespace
 * (a common copy-paste mistake from a .env file).
 */
export function readSecret(name: string): string | undefined {
  let v = process.env[name];
  if (!v) return undefined;
  v = v.trim();
  while (v.startsWith(`${name}=`)) v = v.slice(name.length + 1).trim();
  v = v.replace(/^["']|["']$/g, "").trim();
  return v || undefined;
}
