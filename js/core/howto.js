// =========================================================
// "HOW TO PLAY" cards — shown on the big screen AND every device
// before round 1 (about 12 seconds, the teacher can skip).
// Each game has 3 steps with a little looping animation, plus "how to win".
// Games without an entry simply skip the card.
// =========================================================
import { sprite } from './assets.js?v=20261015141427';

const S = (n) => sprite(n);

/**
 * Mini animated scenes, built from the game's own art + CSS animation (see .ht-* in ui.css).
 * Each is a function of a few pictures so every game can reuse them.
 */
const IMG = (n, cls = '') => `<img class="${cls}" src="${S(n)}" alt="">`;
const SCENES = {
  // a phone quiz: a tile lights up green and a reward pops out
  answer: ({ img = 'egg_blue', plus = '+1' } = {}) => `<div class="ht-scene ht-quiz">
      <div class="ht-tiles"><i class="a"></i><i class="b ok"></i><i class="c"></i><i class="d"></i></div>
      ${IMG(img, 'ht-pop')}<b class="ht-plus">${plus}</b></div>`,
  // drag a joystick: the knob circles and the character runs with it
  joystick: ({ runner = 'chicken_run' } = {}) => `<div class="ht-scene ht-move">
      <div class="ht-pad">${IMG('joystick')}<i class="ht-knob"></i><i class="ht-finger"></i></div>
      ${IMG(runner, 'ht-runner')}</div>`,
  // something flies in an arc from the left and splats the target on the right
  throwAt: ({ from = 'chicken_throw', shot = 'egg_blue', target = 'turkey_run', hit = 'turkey_dizzy', splat = 'splat' } = {}) => `<div class="ht-scene ht-throw">
      ${IMG(from, 'ht-thrower')}${IMG(shot, 'ht-egg')}
      ${IMG(target, 'ht-target')}${hit ? IMG(hit, 'ht-target-hit') : ''}${splat ? IMG(splat, 'ht-splat') : ''}</div>`,
  // a finger taps an object and something pops up from it
  tap: ({ img, pop = '', popImg = '', bg = '' } = {}) => `<div class="ht-scene ht-tap ${bg}">
      ${IMG(img, 'ht-tapped')}<i class="ht-ripple"></i><i class="ht-finger2"></i>
      ${popImg ? IMG(popImg, 'ht-tpop') : `<b class="ht-tpop">${pop}</b>`}</div>`,
  // a finger drags a line from one building to another and little troops march along it
  drag: ({ from = 'tw_coop_c1', to = 'tw_coop_n2', unit = 'tw_chick1' } = {}) => `<div class="ht-scene ht-drag">
      ${IMG(from, 'ht-from')}${IMG(to, 'ht-to')}<i class="ht-line"></i><i class="ht-finger3"></i>
      ${[0, 1, 2].map((i) => IMG(unit, `ht-unit u${i}`)).join('')}</div>`,
  // a bird hops up across a road while traffic drives past
  hop: ({ bird = 'tw_chick1', car = 'cr_tractor_t' } = {}) => `<div class="ht-scene ht-hop">
      <i class="ht-road r1"></i><i class="ht-road r2"></i>${IMG(car, 'ht-car')}${IMG(bird, 'ht-bird')}<i class="ht-finger4"></i></div>`,
  // blocks drop one after another onto a wobbly pile
  stack: ({ blocks = ['f_blue_crate', 'f_hay', 'f_blue_plank', 'f_blue_block'] } = {}) => `<div class="ht-scene ht-stack">
      <i class="ht-cliff"></i>${blocks.map((b, i) => IMG(b, `ht-blk b${i}`)).join('')}</div>`,
  // a chess piece steps forward across a checkerboard (green squares = where you can go)
  board: ({ piece = 'adv_c_k_w', enemy = 'adv_t_n_k', push = false } = {}) => `<div class="ht-scene ht-board ${push ? 'push' : ''}">
      <div class="ht-chk">${Array.from({ length: 15 }, (_, i) => `<i class="${i % 2 ? 'd' : ''}"></i>`).join('')}</div>
      <i class="ht-go g1"></i><i class="ht-go g2"></i>${IMG(piece, 'ht-piece')}${enemy ? IMG(enemy, 'ht-enemy') : ''}</div>`,
  // territory grab: leave your land, draw a loop, it fills in
  loop: ({ runner = 'chicken_run' } = {}) => `<div class="ht-scene ht-loop">
      <svg viewBox="0 0 200 110" preserveAspectRatio="none"><rect class="home" x="8" y="30" width="54" height="50" rx="6"/>
        <path class="fill" d="M62 40 L150 22 L178 70 L120 96 L62 72 Z"/><path class="trail" d="M62 40 L150 22 L178 70 L120 96 L62 72"/></svg>
      ${IMG(runner, 'ht-looper')}</div>`,
  // a target slides left and right on a rail (dodging) with arrow buttons lighting up
  slide: ({ piece = 'adv_c_q_g' } = {}) => `<div class="ht-scene ht-slide">
      <i class="ht-rail"></i><div class="ht-slider">${IMG(piece)}<i class="ht-bull"></i></div>
      <b class="ht-arrow l">◀</b><b class="ht-arrow r">▶</b></div>`,
  // a building upgrades into a bigger one
  upgrade: ({ a = 'fm_coop_c1', b = 'fm_coop_c4' } = {}) => `<div class="ht-scene ht-upg">
      ${IMG(a, 'ht-a')}${IMG(b, 'ht-b')}<b class="ht-up">⬆</b><i class="ht-finger2"></i></div>`,
  // a defence is placed on a lawn grid square, an attacker walks down the row into it
  lawn: ({ def = 'sg_shooter_c', atk = 'sg_raider_t1' } = {}) => `<div class="ht-scene ht-lawn">
      <div class="ht-grass">${Array.from({ length: 10 }, (_, i) => `<i class="${(i + Math.floor(i / 5)) % 2 ? 'd' : ''}"></i>`).join('')}</div>
      ${IMG(def, 'ht-def')}${IMG(atk, 'ht-atk')}${IMG('egg_blue', 'ht-pea')}</div>`,
};

/**
 * HOWTO[mode] = { title, steps: [{ scene, big, small }], win, note(settings) }
 * Keep the words SHORT — they're read from the back of the classroom.
 */
export const HOWTO = {
  dodge: {
    title: 'DODGE EGG',
    steps: [
      { scene: 'answer', big: 'Answer questions', small: 'Every right answer = 1 egg 🥚 (streaks earn bonus eggs!)' },
      { scene: 'joystick', big: 'Drag LEFT side to move', small: 'Keep moving — dodge the eggs flying at you!' },
      { scene: 'throwAt', big: 'Drag RIGHT side, let go to throw', small: 'Splat the other team for KO points' },
    ],
    win: 'Most KO points when time runs out wins!',
    note: (st) => (st?.koMode === 'out' ? 'Get splatted = out for the round 😵' : 'Get splatted = back in 5 seconds 😵'),
  },
  cannon: {
    title: 'EGG CANNON',
    steps: [
      { scene: 'answer', big: 'Answer 5 questions', small: 'Every right answer loads 1 egg into your cannon' },
      { scene: 'tap', p: { img: 'c_chicken_aim', pop: 'FIRE!' }, big: 'Hold, aim, let go!', small: 'Hold your finger down and slide it to aim — let go when the power bar is just right' },
      { scene: 'throwAt', p: { from: 'c_chicken_fire', target: 't_turkey', hit: 't_turkey_ko' }, big: 'Knock down the targets!', small: 'You play on your own device · every target you knock over = 1 point for your team' },
    ],
    win: 'Most targets hit wins!',
  },
  farm: {
    title: 'EGG FARM',
    steps: [
      { scene: 'tap', p: { img: 'fm_coop_c2', popImg: 'tw_chick1' }, big: 'Hold HATCH', small: 'Chicks run into your coops and lay eggs = 💰' },
      { scene: 'upgrade', big: 'Tap to upgrade & build', small: 'Bigger coops, faster trucks, egg machines' },
      { scene: 'answer', p: { img: 'fm_goldegg', plus: 'BOOST!' }, big: 'Answer = STAMPEDE!', small: 'Free chicks, cash, golden eggs and a ⚡×3 boost' },
    ],
    win: 'Most money earned wins!',
    note: () => 'Tap the fox 3 times before it reaches a coop 🦊',
  },
  towers: {
    title: 'COOP WARS',
    steps: [
      { scene: 'tap', p: { img: 'tw_coop_c3', pop: '+8 🐔' }, big: 'Tap your building', small: 'Answer the question → troops go to THAT building' },
      { scene: 'drag', big: 'Hold & drag to attack', small: 'Draw a line to march troops at another building' },
      { scene: 'tap', p: { img: 'tw_coop_n3', pop: 'CAPTURED!' }, big: 'Get it to 0 = yours!', small: 'Swipe across your line to cut it' },
    ],
    win: 'Most buildings at the end wins!',
  },
  siege: {
    title: 'COOP SIEGE',
    steps: [
      { scene: 'answer', p: { img: 'sg_corn', plus: '+50' }, big: 'Answer = 🌽 corn', small: 'Spend corn in the shop' },
      { scene: 'lawn', big: 'Defend: tap the lawn', small: 'Put egg shooters, walls and traps in front of your coop' },
      { scene: 'lawn', p: { def: 'sg_wall_c', atk: 'sg_brute_t1' }, big: 'Attack: tap a row', small: 'Send raiders to break into their coop' },
    ],
    win: '2 halves — teams swap. Most points wins!',
  },
  paint: {
    title: 'LAND GRAB',
    steps: [
      { scene: 'answer', p: { img: 'ico_chicken', plus: '+1 ⚡' }, big: 'Answer = faster!', small: 'Every right answer makes you faster in the land grab' },
      { scene: 'loop', big: 'Drag to steer', small: 'Leave your land, draw a loop, get back home = it\'s yours!' },
      { scene: 'tap', p: { img: 't_chicken_ko', pop: 'OUT!' }, big: 'Don\'t get cut!', small: 'If an enemy crosses your trail before you get home, you\'re OUT' },
    ],
    win: 'Biggest % of the field wins!',
  },
  advance: {
    title: 'ADVANCE',
    steps: [
      { scene: 'answer', p: { img: 'adv_c_k_w', plus: '+1 move' }, big: 'Answer = 1 move', small: 'Go to the BOARD and tap a green square' },
      { scene: 'board', big: 'Forward, diagonal or sideways', small: 'Or drop a 🧱 hay-bale block to get in their way' },
      { scene: 'board', p: { push: true }, big: 'Push them back!', small: 'Tap a purple enemy in front of / beside you' },
    ],
    win: 'Get your whole team to the other side!',
    note: () => 'Out of time? The team further across wins the round',
  },
  eggtoss: {
    title: 'EGG TOSS',
    steps: [
      { scene: 'answer', big: 'Answer questions', small: 'Flingers earn 2 eggs each — dodgers shrink their target' },
      { scene: 'throwAt', p: { from: 'turkey_throw', shot: 'egg_red', target: 'adv_c_q_g', hit: 'cr_flat_c' }, big: 'Fling: hold, aim, let go', small: 'Hit the BULLSEYE on their piece' },
      { scene: 'slide', big: 'Dodge: hold ◀ ▶', small: 'Slide along your rail so the eggs miss' },
    ],
    win: 'Most targets hit wins! Teams swap every round',
  },
  cross: {
    title: 'CROSS THE ROAD',
    steps: [
      { scene: 'answer', p: { img: 'tw_chick1', plus: '+4 🐾' }, big: 'Right answer = 4 hops', small: 'Save up to 12 hops' },
      { scene: 'hop', big: 'Tap to hop!', small: 'Or swipe / use the arrows. Dodge the traffic, ride the logs' },
      { scene: 'tap', p: { img: 'cr_win_c', pop: '+1!' }, big: 'Reach the other side = +1', small: 'Splat or splash = back to the start' },
    ],
    win: 'Most crossings wins!',
  },
  flag: {
    title: 'CAPTURE THE FLAG',
    steps: [
      { scene: 'answer', p: { img: 'chicken_run', plus: '+1 ⚡' }, big: 'Answer = speed', small: 'Every right answer makes your runner faster' },
      { scene: 'joystick', big: 'Drag to run', small: 'Grab their flag and bring it back over the halfway line = 1 point' },
      { scene: 'tap', p: { img: 'turkey_dizzy', pop: 'FROZEN!' }, big: 'Careful on their side!', small: 'Touched for 1 second = frozen until a teammate frees you. Their flag area is safe!' },
    ],
    win: 'Most flags captured wins!',
  },
  stack: {
    title: 'STACK ATTACK',
    steps: [
      { scene: 'answer', p: { img: 'f_blue_crate', plus: '+1 ⚡' }, big: 'Right answer = 1 action', small: 'Save up to 5' },
      { scene: 'stack', big: 'BUILD: drag, turn, DROP', small: 'Stack carefully — wobbly towers fall!' },
      { scene: 'throwAt', p: { from: 'turkey_throw', shot: 'egg_red', target: 'f_blue_crate', hit: 'f_hay3' }, big: 'THROW: hold, aim, let go', small: 'Knock blocks off their tower' },
    ],
    win: 'Tallest tower wins! (heights add up each round)',
  },
};

export const hasHowto = (mode) => !!HOWTO[mode];

/** HTML for the card. opts.big = projector size, opts.ms = how long it shows (drives the progress bar). */
export function howtoHTML(mode, settings = {}, { big = false, ms = 12000, skip = false } = {}) {
  const h = HOWTO[mode]; if (!h) return '';
  const steps = h.steps.map((s, i) => `<div class="ht-step" style="--d:${0.25 + i * 0.45}s">
      <div class="ht-num">${i + 1}</div>${SCENES[s.scene]?.(s.p) || ''}
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
