/**
 * Configuração das coordenadas exatas da planta real do estacionamento
 * do Capim Dourado Shopping (`public/images/planta-capim-dourado.jpg`).
 *
 * Dimensões reais verificadas do arquivo JPEG: 788 × 1024 pixels.
 * O `<image>` de fundo e todas as regiões interativas dos setores A–G
 * compartilham o mesmo `viewBox="0 0 788 1024"`, garantindo alinhamento
 * geométrico invariável em qualquer resolução ou nível de zoom.
 */
export const PARKING_MAP_LAYOUT = Object.freeze({
  type: 'floorplan-svg',
  imageUrl: '/images/planta-capim-dourado.jpg',
  viewBox: {
    width: 788,
    height: 1024,
  },
  access: {
    label: 'Q. 107 Norte Av. LO 2 A — Acessos principais',
    side: 'top',
  },
  /**
   * Regiões dos 7 setores (A até G) em coordenadas do viewBox 788 × 1024.
   * Cada região cobre exclusivamente o bolsão do respectivo setor na planta,
   * sem sobrepor edificações ou vias externas.
   */
  sectors: Object.freeze({
    A: {
      id: 'A',
      x: 108,
      y: 318,
      width: 304,
      height: 175,
      rx: 8,
      labelX: 192,
      labelY: 428,
      badgeX: 315,
      badgeY: 348,
    },
    B: {
      id: 'B',
      x: 153,
      y: 495,
      width: 117,
      height: 152,
      rx: 8,
      labelX: 211,
      labelY: 576,
      badgeX: 211,
      badgeY: 516,
    },
    C: {
      id: 'C',
      x: 204,
      y: 649,
      width: 187,
      height: 121,
      rx: 8,
      labelX: 280,
      labelY: 713,
      badgeX: 332,
      badgeY: 672,
    },
    D: {
      id: 'D',
      x: 242,
      y: 771,
      width: 169,
      height: 62,
      rx: 6,
      labelX: 316,
      labelY: 805,
      badgeX: 368,
      badgeY: 788,
    },
    E: {
      id: 'E',
      x: 686,
      y: 138,
      width: 81,
      height: 147,
      rx: 6,
      labelX: 726,
      labelY: 214,
      badgeX: 726,
      badgeY: 160,
    },
    F: {
      id: 'F',
      x: 686,
      y: 287,
      width: 79,
      height: 166,
      rx: 6,
      labelX: 725,
      labelY: 373,
      badgeX: 725,
      badgeY: 310,
    },
    G: {
      id: 'G',
      x: 667,
      y: 653,
      width: 111,
      height: 233,
      rx: 8,
      labelX: 722,
      labelY: 774,
      badgeX: 722,
      badgeY: 680,
    },
  }),
  /**
   * Região da legenda estática original no canto inferior esquerdo da imagem,
   * substituída no SVG pela legenda dinâmica das faixas de ocupação (Verde/Amarelo/Vermelho).
   */
  staticLegendBox: Object.freeze({
    x: 6,
    y: 806,
    width: 222,
    height: 212,
    rx: 12,
  }),
});
