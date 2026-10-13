// Grown-up avatars: male and female lion, tiger, elephant, wolf and bear.
// Emoji have no male/female animals, so these are small drawings. Males: the
// lion's mane, the elephant's tusks, a bow tie for the rest. Females: lashes
// and a flower. Fixed colours, drawn on their own disc, so they read the same
// in light and dark mode.
(() => {
  "use strict";

  const INK = "#1f1a17";
  const disc = (fill) => `<circle cx="50" cy="50" r="50" fill="${fill}"/>`;

  function eyes(y, dx) {
    return [50 - dx, 50 + dx].map((x) =>
      `<circle cx="${x}" cy="${y}" r="4" fill="${INK}"/><circle cx="${x + 1.3}" cy="${y - 1.4}" r="1.3" fill="#fff"/>`).join("");
  }

  function lashes(y, dx) {
    return [[50 - dx, -1], [50 + dx, 1]].map(([x, side]) => [
      [x + side * 2.5, y - 3.5, x + side * 5.5, y - 7.5],
      [x, y - 4.2, x, y - 8.5],
      [x - side * 2.5, y - 3.5, x - side * 4, y - 7.5],
    ].map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`).join("")).join("");
  }

  function flower(x, y) {
    const petals = [0, 72, 144, 216, 288].map((deg) => {
      const r = (deg * Math.PI) / 180;
      return `<circle cx="${(x + 5 * Math.cos(r)).toFixed(1)}" cy="${(y + 5 * Math.sin(r)).toFixed(1)}" r="4.2" fill="#ec4899"/>`;
    }).join("");
    return `${petals}<circle cx="${x}" cy="${y}" r="3.2" fill="#fde047"/>`;
  }

  const bowtie = (y) => `<path d="M50 ${y} L37 ${y - 6} L37 ${y + 6} Z M50 ${y} L63 ${y - 6} L63 ${y + 6} Z" fill="#2563eb" stroke="#1e3a8a" stroke-width="1" stroke-linejoin="round"/><circle cx="50" cy="${y}" r="3.2" fill="#1e3a8a"/>`;

  const mouth = (y) => `<path d="M50 ${y} L50 ${y + 3.5} M50 ${y + 3.5} Q46 ${y + 7.5} 42.5 ${y + 4.5} M50 ${y + 3.5} Q54 ${y + 7.5} 57.5 ${y + 4.5}" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;

  function lion(female) {
    let mane = "";
    if (!female) {
      mane = `<circle cx="50" cy="52" r="38" fill="#c2410c"/>`;
      for (let i = 0; i < 14; i++) {
        const r = (i / 14) * Math.PI * 2;
        mane += `<circle cx="${(50 + 35 * Math.cos(r)).toFixed(1)}" cy="${(52 + 35 * Math.sin(r)).toFixed(1)}" r="11" fill="#9a3412"/>`;
      }
    }
    const face = female ? "#f59e0b" : "#fbbf24";
    const ear = female ? "#d97706" : "#f59e0b";
    return `${disc("#fdecc8")}${mane}
      <circle cx="${female ? 28 : 31}" cy="31" r="${female ? 10 : 8}" fill="${ear}"/><circle cx="${female ? 28 : 31}" cy="31" r="${female ? 5 : 4}" fill="#fde68a"/>
      <circle cx="${female ? 72 : 69}" cy="31" r="${female ? 10 : 8}" fill="${ear}"/><circle cx="${female ? 72 : 69}" cy="31" r="${female ? 5 : 4}" fill="#fde68a"/>
      <circle cx="50" cy="54" r="${female ? 30 : 26}" fill="${face}"/>
      <ellipse cx="43.5" cy="65" rx="8" ry="6.5" fill="#fef3c7"/><ellipse cx="56.5" cy="65" rx="8" ry="6.5" fill="#fef3c7"/>
      ${eyes(50, 10)}${female ? lashes(50, 10) : ""}
      <path d="M45 58 L55 58 L50 63.5 Z" fill="#7c2d12" stroke="#7c2d12" stroke-width="2" stroke-linejoin="round"/>
      ${mouth(63.5)}${female ? flower(74, 20) : ""}`;
  }

  function tiger(female) {
    const stripe = (d) => `<path d="${d}" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    return `${disc("#ffedd5")}
      <circle cx="27" cy="28" r="10" fill="#ea580c"/><circle cx="27" cy="28" r="5" fill="#fff7ed"/>
      <circle cx="73" cy="28" r="10" fill="#ea580c"/><circle cx="73" cy="28" r="5" fill="#fff7ed"/>
      <circle cx="50" cy="54" r="33" fill="#f97316"/>
      <ellipse cx="38" cy="67" rx="12" ry="9" fill="#fff7ed"/><ellipse cx="62" cy="67" rx="12" ry="9" fill="#fff7ed"/>
      ${stripe("M43 23 Q45.5 29 43.5 35")}${stripe("M50 21.5 L50 33")}${stripe("M57 23 Q54.5 29 56.5 35")}
      ${stripe("M18 49 L28 51.5")}${stripe("M18.5 57 L27 57.5")}${stripe("M82 49 L72 51.5")}${stripe("M81.5 57 L73 57.5")}
      ${eyes(48, 12)}${female ? lashes(48, 12) : ""}
      <path d="M45.5 60 L54.5 60 L50 65 Z" fill="#db2777" stroke="#db2777" stroke-width="2" stroke-linejoin="round"/>
      ${mouth(65)}${female ? flower(75, 20) : bowtie(90)}`;
  }

  function elephant(female) {
    const skin = "#a3b2c7", ear = "#8b9bb3";
    const tusks = female ? "" : `
      <path d="M41 62 C36 70 33 73 28 73 C33 67 36 63 39.5 58 Z" fill="#fffbeb" stroke="#d6d3d1" stroke-width="1"/>
      <path d="M59 62 C64 70 67 73 72 73 C67 67 64 63 60.5 58 Z" fill="#fffbeb" stroke="#d6d3d1" stroke-width="1"/>`;
    return `${disc("#e0f2fe")}
      <ellipse cx="22" cy="48" rx="18" ry="24" fill="${ear}"/><ellipse cx="24" cy="48" rx="11" ry="16" fill="#f9a8d4"/>
      <ellipse cx="78" cy="48" rx="18" ry="24" fill="${ear}"/><ellipse cx="76" cy="48" rx="11" ry="16" fill="#f9a8d4"/>
      <ellipse cx="50" cy="45" rx="25" ry="25" fill="${skin}"/>
      ${tusks}
      <path d="M43 56 C43 72 39 82 45 90 C48.5 94 54.5 92 52.5 86.5 C50.5 80 57 72 57 56 Z" fill="${skin}"/>
      <path d="M45 74 Q49 75.5 53 74 M44.5 80 Q48 81.5 51.5 80" stroke="#7d8ca3" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      ${eyes(43, 11)}${female ? lashes(43, 11) : ""}
      ${female ? flower(68, 22) : ""}`;
  }

  function wolf(female) {
    return `${disc("#e0e7ff")}
      <path d="M23 42 L27 10 L45 28 Z" fill="#6b7280"/><path d="M28.5 34 L30 19 L39 28.5 Z" fill="#fbcfe8"/>
      <path d="M77 42 L73 10 L55 28 Z" fill="#6b7280"/><path d="M71.5 34 L70 19 L61 28.5 Z" fill="#fbcfe8"/>
      <ellipse cx="50" cy="52" rx="31" ry="29" fill="#6b7280"/>
      <path d="M50 38 C37 38 29 51 33 64 C37 77 63 77 67 64 C71 51 63 38 50 38 Z" fill="#e5e7eb"/>
      <ellipse cx="50" cy="69" rx="11" ry="9" fill="#f9fafb"/>
      ${eyes(50, 11)}${female ? lashes(50, 11) : ""}
      <ellipse cx="50" cy="63" rx="5.5" ry="3.8" fill="#111827"/>
      ${mouth(66.5)}${female ? flower(71, 22) : bowtie(89)}`;
  }

  function bear(female) {
    return `${disc("#fef3c7")}
      <circle cx="27" cy="27" r="11" fill="#92400e"/><circle cx="27" cy="27" r="6" fill="#d6a77a"/>
      <circle cx="73" cy="27" r="11" fill="#92400e"/><circle cx="73" cy="27" r="6" fill="#d6a77a"/>
      <circle cx="50" cy="54" r="32" fill="#a0522d"/>
      <ellipse cx="50" cy="66" rx="14" ry="11" fill="#e7c39b"/>
      ${eyes(48, 12)}${female ? lashes(48, 12) : ""}
      <ellipse cx="50" cy="61" rx="6" ry="4.2" fill="${INK}"/>
      ${mouth(64.5)}${female ? flower(75, 19) : bowtie(91)}`;
  }

  const DRAW = { lion, tiger, elephant, wolf, bear };

  /** An <svg> for a grown-up avatar id such as "bear-f". */
  function svg(id, size = 48, label = "") {
    const [animal, sex] = String(id).split("-");
    const draw = DRAW[animal] || lion;
    return `<svg class="pav" viewBox="0 0 100 100" width="${size}" height="${size}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${draw(sex === "f")}</svg>`;
  }

  window.LearnAvatars = { svg };
})();
