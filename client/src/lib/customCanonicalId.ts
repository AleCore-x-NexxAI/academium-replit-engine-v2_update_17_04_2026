export async function customCanonicalId(name: string): Promise<string> {
  const norm = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const data = new TextEncoder().encode(norm);
  const hashBuf = await crypto.subtle.digest("SHA-1", data);
  const hex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `custom_${hex.slice(0, 10)}`;
}
