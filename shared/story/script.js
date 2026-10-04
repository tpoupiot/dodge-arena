// Textes de l'histoire. who : clé du boss qui parle (voir BOSSES), ou '' pour la narration.

export const SCRIPT = {
  intro: { who: '', text: 'Sous l\'Arène dort celui qui l\'a bâtie. Cette nuit, il s\'est éveillé et a pris toute ta magie. Il ne te reste qu\'un sort. Les autres sont en bas. Descends.' },
  boss1: { who: 'gardien', text: 'Nul ne descend plus bas.' },
  boss1p3: { who: 'gardien', text: 'La pierre… ne cède… pas !' },
  boss1end: { who: '', text: 'Le Gardien s\'effondre. Derrière lui, un escalier, et une lueur rouge.' },
  ch2: { who: '', text: 'La chaleur monte. C\'est ici qu\'on forge les coffres qui retiennent tes sorts.' },
  boss2: { who: 'forgeronne', text: 'Tes sorts font de très bons lingots.' },
  boss2p3: { who: 'forgeronne', text: 'Assez joué. Au feu !' },
  boss2end: { who: '', text: 'Les fourneaux s\'éteignent. Le dernier escalier s\'enfonce dans le noir.' },
  ch3: { who: '', text: 'Plus de murs, plus de ciel. Seulement lui, et tout ce qu\'il a volé.' },
  boss3: { who: 'archonte', text: 'Chaque sort lancé là-haut m\'a nourri. Les tiens aussi.' },
  boss3p3: { who: 'archonte', text: 'Ils sont à moi. Tous !' },
  win: { who: '', text: 'L\'Archonte se dissipe. La magie qu\'il retenait remonte d\'un coup vers l\'Arène, et retombe en pluie de sorts. Là-haut, il va falloir apprendre à esquiver.' },
  lose: { who: '', text: 'Le Vide garde tes sorts. L\'Arène attendra un autre champion.' },
};
