/**
 * Generates a human-friendly, admin-readable numeric ID with a given prefix.
 * e.g., generateReadableId("ORDER") => "ORDER124224"
 *       generateReadableId("COUPON") => "COUPON124224"
 *       generateReadableId("PACKAGE") => "PACKAGE124224"
 *       generateReadableId("TXN") => "TXN124224"
 *       generateReadableId("ADJ") => "ADJ124224"
 */
export function generateReadableId(prefix: string, digits: number = 6): string {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  let num: number;

  if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    num = min + (array[0] % (max - min + 1));
  } else {
    num = Math.floor(min + Math.random() * (max - min + 1));
  }

  return `${prefix}${num}`;
}

