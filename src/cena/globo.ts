// O laptop ao vivo (Three.js), no lugar que era do globo: o modelo public/models/laptop.glb com a tampa que se abre na
// entrada e, na tela, um editor em que uma função curta se digita sozinha (tela.ts); cada letra acende a tecla dela
// no teclado, na cor do --color-acento. coreografia.ts, arrasto.ts e voo.ts só conhecem a interface Globo (o nome
// ficou: é a camada .globo da página). Câmera ortográfica em pixels de CSS: o laptop é posicionado e medido como um
// elemento da página; r é a metade da largura dele.
import {
  CanvasTexture, Color, DirectionalLight, Group, HemisphereLight, LinearFilter, Mesh, MeshStandardMaterial,
  NeutralToneMapping, type Object3D, OrthographicCamera, PMREMGenerator, Box3, Scene, ShaderMaterial, SRGBColorSpace,
  Vector3, Vector4, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { reduzido } from '../core/rolagem.ts';
import { criarEditor, type TelaEditor, teclasDe } from './tela.ts';

export interface Regiao { lat: number; lon: number }

/** o estado do laptop na tela: centro (px), meia largura (px) e a pose (graus): lat inclina (positivo mostra o
 *  teclado de cima), lon vira (0 é de frente, positivo vira a tela para a esquerda) */
export interface Pose { cx: number; cy: number; r: number; lat: number; lon: number }

/** um ponto da tela do laptop (px de CSS) e quanto a tela está de frente (-1 a 1) */
export interface Projecao { x: number; y: number; face: number }

export interface Globo {
  /** o brilho de cada região (0 a 1,6), escrito pela coreografia. Desde o editor, não aparece na tela */
  brilho: Float32Array;
  /** a tampa: 0 fechada, 1 aberta (escrito pela coreografia) */
  abertura: number;
  medir(w: number, h: number): void;
  aplicar(e: Pose): void;
  /** o meio da tela do laptop (o voo até a busca saía daqui; a busca saiu da página) */
  projetar(i: number, alvo: Projecao): Projecao;
  /** começa a digitação (s, no relógio de performance.now) */
  ligar(agora: number): void;
  desenhar(): void;
  /** chamado uma vez quando o modelo chega (na hora, se já chegou) */
  set onPronto(fn: () => void);
}

// as regiões da lista <ol class="globo__regioes"> do index.html: a coreografia ainda conta com elas
const RESERVA: [number, number][] = [[-23.5, -46.6], [-3.7, -38.5], [-33.4, -70.6], [4.7, -74.1], [19.4, -99.1],
  [38.9, -77.4], [37.4, -121.9], [38.7, -9.1], [50.1, 8.7], [-26.2, 28.0], [1.35, 103.8], [35.7, 139.7]];
const lista = document.querySelector<HTMLElement>('.globo__regioes');
const lidas: Regiao[] = lista
  ? [...lista.querySelectorAll('li')].map((li) => ({ lat: Number(li.dataset.lat), lon: Number(li.dataset.lon) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon))
  : [];
export const REGIOES: Regiao[] = lidas.length ? lidas : RESERVA.map(([lat, lon]) => ({ lat, lon }));
const N = REGIOES.length;
const indice = (k: string, padrao: number): number => {
  const v = Number(lista?.dataset[k]);
  return Number.isInteger(v) && v >= 0 && v < N ? v : Math.min(padrao, N - 1);
};
/** data-cai e data-assume: a falha da segunda frase; data-voa: o ponto que voa até a busca */
export const PAPEIS = { cai: indice('cai', 7), assume: indice('assume', 8), voa: indice('voa', 10) };

// caminho de arquivo no TS vai pela base do site: "/models/..." quebraria o site publicado numa subpasta
const BASE = import.meta.env.BASE_URL;
const RAD = Math.PI / 180;
/** a tampa aberta: o ângulo em que o modelo veio do Blender */
const ABERTA = 105 * RAD;
/** a digitação começa quando a tampa já abriu (a tampa leva 1,4 s) */
const ESPERA = 1.6;
/** quantas teclas podem estar acesas ao mesmo tempo (a letra, o shift e as que ainda apagam) */
const ACESAS = 6;

const vertTela = /* glsl */ `
  uniform vec4 uCaixa;
  varying vec2 vUv;
  void main() {
    vUv = vec2((position.x - uCaixa.x) / uCaixa.z, (position.z - uCaixa.y) / uCaixa.w);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// a tela: o editor (um canvas), a luz que cai nas bordas e um reflexo fosco em diagonal, mesmo com a tela apagada
const fragTela = /* glsl */ `
  uniform sampler2D uTexto;
  uniform float uLigada;
  varying vec2 vUv;
  void main() {
    vec3 cor = texture2D(uTexto, vUv).rgb * uLigada;
    vec2 v = vUv - 0.5;
    cor *= 1.0 - dot(v, v) * 0.7;
    cor += vec3(smoothstep(0.25, 0.0, abs(vUv.x * 0.8 + vUv.y - 1.25)) * 0.022);
    gl_FragColor = vec4(cor, 1.0);
    #include <colorspace_fragment>
  }
`;

const suaveSaida = (t: number): number => 1 - Math.pow(1 - t, 3);

/** leve: menos pixels (celular, máquina fraca) */
export function criarGlobo(canvas: HTMLCanvasElement, { leve = false } = {}): Globo {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = NeutralToneMapping;
  const dpr = Math.min(window.devicePixelRatio || 1, leve ? 1.5 : 2);
  renderer.setPixelRatio(dpr);

  const cena = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
  camera.position.set(0, 0, 2000);

  // luz: a principal de cima à esquerda, um recorte quente por trás à direita e um ambiente fosco para o plástico
  // ter reflexo
  const pmrem = new PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  cena.environmentIntensity = 0.32;
  cena.add(new HemisphereLight(0xf4efe8, 0x0b0a0a, 0.5));
  const chave = new DirectionalLight(0xfff6ec, 2.1);
  chave.position.set(-0.78, 0.62, 0.52);
  const recorte = new DirectionalLight(0xffe2cc, 2.6);
  recorte.position.set(0.9, 0.35, -0.8);
  cena.add(chave, recorte);

  // a cor do acento vem dos tokens (src/styles/tokens.css): trocar a paleta troca a luz das teclas e do cursor
  const acento = new Color(getComputedStyle(document.documentElement).getPropertyValue('--color-acento').trim() || '#e8294c');
  const brilho = new Float32Array(N);

  const uniTela = {
    uTexto: { value: null as CanvasTexture | null },
    uLigada: { value: 0 },
    uCaixa: { value: [0, 0, 1, 1] as number[] },
  };
  // as teclas acesas: x e z no espaço do teclado, a força (0 a 1) e a meia largura
  const teclas = Array.from({ length: ACESAS }, () => new Vector4(0, 0, 0, 0.1));
  const uniTeclas = { uTeclas: { value: teclas }, uAcentoTecla: { value: acento } };

  const grupo = new Group(); // a pose (posição, tamanho, giro)
  cena.add(grupo);
  let tampa: Object3D | null = null;
  let luzTeclado: MeshStandardMaterial | null = null;
  let editor: TelaEditor | null = null;
  let textura: CanvasTexture | null = null;
  const meioTela = new Vector3();
  const normalTela = new Vector3(0, -1, 0); // a tela olha para -y no espaço da tampa

  let pronto = false;
  let aoCarregar: (() => void) | null = null;

  /** a luz de cada tecla: entra no emissivo do material, pela posição no espaço do teclado */
  function acenderPorPosicao(m: MeshStandardMaterial): void {
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniTeclas);
      s.vertexShader = `varying vec2 vTecla;\n${s.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vTecla = position.xz;');
      s.fragmentShader = `uniform vec4 uTeclas[${ACESAS}];\nuniform vec3 uAcentoTecla;\nvarying vec2 vTecla;\n${s.fragmentShader}`
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  float tecla = 0.0;
  for (int i = 0; i < ${ACESAS}; i++) {
    // a caixa da tecla, de borda macia (uma tecla mede ~0,25 de lado)
    vec2 d = abs(vTecla - uTeclas[i].xy) / vec2(uTeclas[i].w, 0.095);
    tecla += uTeclas[i].z * (1.0 - smoothstep(0.62, 0.92, max(d.x, d.y)));
  }
  totalEmissiveRadiance += uAcentoTecla * min(tecla, 1.0) * 1.25;`);
    };
    m.needsUpdate = true;
  }

  new GLTFLoader().load(`${BASE}models/laptop.glb`, (gltf) => {
    const modelo = gltf.scene;
    tampa = modelo.getObjectByName('monitor') ?? null;
    let tela: Mesh | null = null;
    modelo.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const m = o.material as MeshStandardMaterial;
      if (m.name === 'laptop.monitor') tela = o;
      else if (m.name === 'laptop.backlights') {
        // o corpo das teclas: grafite, com um fundo de luz do acento que acende com a tampa
        m.color.setScalar(0.03);
        m.emissive.copy(acento);
        m.emissiveIntensity = 0;
        luzTeclado = m;
        acenderPorPosicao(m);
      } else if (m.name === 'laptop.keyboard') {
        // as teclas vêm brancas na textura: ficam grafite e a luz passa pelas letras
        m.color.setScalar(0.028);
        m.roughness = 0.55;
        acenderPorPosicao(m);
      } else if (m.name === 'laptop.body') {
        m.roughness = 0.42;
        m.metalness = 0.55;
      }
    });
    // a tela troca o vidro preto do modelo pelo editor
    const t = tela as Mesh | null;
    if (t && tampa) {
      t.geometry.computeBoundingBox();
      const cx = t.geometry.boundingBox;
      if (cx) {
        const w = cx.max.x - cx.min.x;
        const h = cx.max.z - cx.min.z;
        uniTela.uCaixa.value = [cx.min.x, cx.min.z, w, h];
        meioTela.set((cx.min.x + cx.max.x) / 2, cx.min.y, (cx.min.z + cx.max.z) / 2);
        editor = criarEditor(w / h, { reduzido });
        textura = new CanvasTexture(editor.canvas);
        textura.colorSpace = SRGBColorSpace;
        textura.minFilter = LinearFilter;
        textura.generateMipmaps = false;
        textura.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        uniTela.uTexto.value = textura;
        editor.quadro(-1);
        textura.needsUpdate = true;
      }
      t.material = new ShaderMaterial({ uniforms: uniTela, vertexShader: vertTela, fragmentShader: fragTela, toneMapped: false });
    }
    // centraliza com a tampa aberta e deixa a largura em 2 (r é a meia largura)
    tampa?.quaternion.setFromAxisAngle(new Vector3(-1, 0, 0), ABERTA);
    modelo.updateMatrixWorld(true);
    const caixa = new Box3().setFromObject(modelo);
    const escala = 2 / Math.max(1e-6, caixa.max.x - caixa.min.x);
    const meio = caixa.getCenter(new Vector3());
    const normal = new Group();
    normal.scale.setScalar(escala);
    modelo.position.sub(meio);
    normal.add(modelo);
    grupo.add(normal);
    aplicar(estado);
    pronto = true;
    aoCarregar?.();
  }, undefined, () => {
    // sem o modelo, a camada fica vazia e a página segue
  });
  // a fonte do site pode chegar depois do modelo: o editor redesenha com ela
  void document.fonts.ready.then(() => { if (editor && textura && editor.quadro(digitando())) textura.needsUpdate = true; });

  let W = 1;
  let H = 1;
  const estado: Pose = { cx: 0, cy: 0, r: 100, lat: 0, lon: 0 };
  const tmp = new Vector3();
  const n = new Vector3();
  let face = -1;
  let inicio = -1; // quando a digitação começa (s); -1 antes de ligar
  let ja = 0; // quantos caracteres já acenderam a tecla
  let antes = -1; // o último quadro (s), para apagar as teclas pelo tempo

  /** s desde o começo da digitação (negativo antes) */
  const digitando = (): number => (inicio < 0 ? -1 : performance.now() / 1000 - inicio);

  function medir(w: number, h: number): void {
    W = w;
    H = h;
    renderer.setSize(w, h, false);
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
  }

  function aplicar(e: Pose): void {
    Object.assign(estado, e);
    grupo.position.set(e.cx - W / 2, H / 2 - e.cy, 0);
    grupo.scale.setScalar(e.r);
    // vira no próprio eixo e depois inclina para a câmera
    grupo.rotation.set(e.lat * RAD, -e.lon * RAD, 0);
    const a = Math.min(1, Math.max(0, api.abertura));
    tampa?.quaternion.setFromAxisAngle(tmp.set(-1, 0, 0), ABERTA * suaveSaida(a));
    grupo.updateMatrixWorld(true);
    if (tampa) {
      face = n.copy(normalTela).transformDirection(tampa.matrixWorld).z;
      // só liga quando a tampa já passou da metade
      uniTela.uLigada.value = Math.min(1, Math.max(0, (a - 0.45) / 0.55));
    }
    if (luzTeclado) luzTeclado.emissiveIntensity = 0.035 * a;
  }

  function projetar(_i: number, alvo: Projecao): Projecao {
    if (!tampa) { alvo.face = -1; return alvo; }
    tmp.copy(meioTela).applyMatrix4(tampa.matrixWorld);
    alvo.x = tmp.x + W / 2;
    alvo.y = H / 2 - tmp.y;
    alvo.face = face * uniTela.uLigada.value;
    return alvo;
  }

  /** a tela e as teclas no instante de agora */
  function digitar(): void {
    const agora = performance.now() / 1000;
    const dt = antes < 0 ? 0 : Math.min(0.1, agora - antes);
    antes = agora;
    // as teclas acesas apagam em uns 0,4 s
    for (const k of teclas) k.z *= Math.exp(-dt * 7);
    if (!editor || !textura) return;
    const t = digitando();
    if (editor.quadro(t)) textura.needsUpdate = true;
    if (reduzido) return;
    const feitos = editor.digitados(t);
    for (; ja < feitos; ja++) {
      for (const tecla of teclasDe(editor.texto[ja] ?? '')) {
        // a tecla ocupa o lugar da mais apagada
        let alvo = teclas[0];
        for (const k of teclas) if (alvo && k.z < alvo.z) alvo = k;
        alvo?.set(tecla.x, tecla.z, 1, tecla.larg);
      }
    }
  }

  const api: Globo = {
    brilho,
    abertura: 0,
    medir,
    aplicar,
    projetar,
    ligar: (agora) => { if (inicio < 0) inicio = agora + ESPERA; },
    desenhar: () => {
      digitar();
      renderer.render(cena, camera);
    },
    set onPronto(fn: () => void) { aoCarregar = fn; if (pronto) fn(); },
  };

  return api;
}
