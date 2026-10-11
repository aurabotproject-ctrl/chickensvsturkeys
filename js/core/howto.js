// =========================================================
// "HOW TO PLAY" cards — shown on the big screen AND every device
// before round 1 (about 12 seconds, the teacher can skip).
// Each game has 3 steps with a little looping animation, plus "how to win".
// Games without an entry simply skip the card.
// =========================================================
import { sprite } from './assets.js?v=20261012124656';

const S = (n) => sprite(n);

/** Mini animated scenes, built from the game's own art + CSS animation (see .ht-* in ui.css). */
const SCENES = {
  // a phone quiz: a tile lights up green and an egg pops out
  answerEgg: () => `<div class="ht-scene ht-quiz">
      <div class="ht-tiles"><i class="a"></i><i class="b ok"></i><i class="c"></i><i class="d"></i></div>
      <img class="ht-pop" src="${S('egg_blue')}" alt=""><b class="ht-plus">+1</b></div>`,
  // drag the left half: joystick knob circles, chicken runs
  moveStick: () => `<div class="ht-scene ht-move">
      <div class="ht-pad"><img src="${S('joystick')}" alt=""><i class="ht-knob"></i><i class="ht-finger"></i></div>
      <img class="ht-runner" src="${S('chicken_run')}" alt=""></div>`,
  // drag the right half to aim, let go: egg arcs over, turkey gets splatted
  aimThrow: () => `<div class="ht-scene ht-throw">
      <img class="ht-thrower" src="${S('chicken_throw')}" alt="">
      <img class="ht-egg" src="${S('egg_blue')}" alt="">
      <img class="ht-target" src="${S('turkey_run')}" alt=""><img class="ht-target-hit" src="${S('turkey_dizzy')}" alt="">
      <img class="ht-splat" src="${S('splat')}" alt=""></div>`,
};

/**
 * HOWTO[mode] = { title, steps: [{ scene, big, small }], win, note(settings) }
 * Keep the words SHORT — they're read from the back of the classroom.
 */
export const HOWTO = {
  dodge: {
    title: 'DODGE EGG',
    steps: [
      { scene: 'answerEgg', big: 'Answer questions', small: 'Every right answer = 1 egg 🥚 (streaks earn bonus eggs!)' },
      { scene: 'moveStick', big: 'Drag LEFT side to move', small: 'Keep moving — dodge the eggs flying at you!' },
      { scene: 'aimThrow', big: 'Drag RIGHT side, let go to throw', small: 'Splat the other team for KO points' },
    ],
    win: 'Most KO points when time runs out wins!',
    note: (st) => (st?.koMode === 'out' ? 'Get splatted = out for the round 😵' : 'Get splatted = back in 5 seconds 😵'),
  },
};

export const hasHowto = (mode) => !!HOWTO[mode];

/** HTML for the card. opts.big = projector size, opts.ms = how long it shows (drives the progress bar). */
export function howtoHTML(mode, settings = {}, { big = false, ms = 12000, skip = false } = {}) {
  const h = HOWTO[mode]; if (!h) return '';
  const steps = h.steps.map((s, i) => `<div class="ht-step" style="--d:${0.25 + i * 0.45}s">
      <div class="ht-num">${i + 1}</div>${SCENES[s.scene]?.() || ''}
      <div class="ht-big">${s.big}</div><div class="ht-small">${s.small}</div></div>`).join('');
  const note = h.note ? h.note(settings) : '';
  return `<div class="howto ${big ? 'big' : ''}">
    <div class="ht-head"><span class="ht-kicker">HOW TO PLAY</span><h1 class="ht-title">${h.title}</h1></div>
    <div class="ht-steps">${steps}</div>
    <div class="ht-win">🏆 ${h.win}${note ? `<small>${note}</small>` : ''}</div>
    <div class="ht-bar"><i style="animation-duration:${ms}ms"></i></div>
    ${skip ? '<button class="btn ht-skip" id="ht-skip">Skip ▶</button>' : ''}
  </div>`;
}
