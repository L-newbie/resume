// ─────────────────────────────────────────────────────────────
// 球体着色器。
//
// 只有球态 —— 没有形变，位置直接用球面坐标。
// CPU 每帧只更新几个 uniform，不碰 attribute buffer。
// ─────────────────────────────────────────────────────────────

/**
 * 鼠标放大镜（球面鱼眼）—— 只作用在**球面照片**那一层。
 *
 * 用户要放大的是球面上的那张背景图（照片），不是点云文字和海岸线：
 * 线条和文字是「贴在取景框上的读数」，跟着一起变形反而像画面坏了。
 * 所以这段只被 photoFragment 引用，其余各层一律不动。
 *
 * ⚠️ 做在**片元**里而不是顶点里。顶点方案（挪顶点、UV 不动）的精度
 * 等于网格密度 —— 照片网格是 24×16，镜区里只有十来个格子，
 * 放大后的照片边缘会出现明显的折面。片元方案是逐像素的，
 * 多大的倍率都平滑，代价只是镜区内每像素几十条指令。
 *
 * ⚠️ 这里算的是**逆映射**：已知屏幕上这个片元落在球面方向 d 上，
 * 反求它该去照片的哪个位置取色。正向（把源点推开）在片元着色里
 * 没法用 —— 片元不知道自己是被谁推过来的。
 * 逆映射 = 解 f(x)=y，f 是那条三次曲线，牛顿迭代四次足够收敛。
 */
export const orbVertex = /* glsl */ `
  attribute vec3 aSphere;   // 球面上的位置
  attribute float aSize;
  attribute float aSeed;
  attribute float aHue;
  attribute float aFace;    // 归属哪块大洲（0–5），海洋记 -1
  attribute float aLand;    // 1 = 陆地，0 = 海洋

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uReveal;    // 入场：0 → 从中心炸开，1 → 就位
  uniform float uFocus;     // 当前正对观众的大洲索引，-1 = 无
  uniform float uFocusMix;  // 高亮强度

  varying float vHue;
  varying float vAlpha;
  varying float vFocus;
  varying float vLand;
  varying float vRim;

  void main() {
    vec3 pos = aSphere;

    // ── 呼吸浮动 ──
    // 陆地几乎不动（要保持大洲轮廓清晰），海洋点飘得明显些
    float t = uTime * 0.5 + aSeed * 6.28;
    float drift = mix(0.13, 0.03, aLand);
    pos.x += sin(t) * drift;
    pos.y += cos(t * 0.83) * drift;
    pos.z += sin(t * 0.71) * drift;

    pos *= uReveal;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // ── 当前大洲高亮 ──
    // 只变色变亮，**不做位移** —— 沿法线浮起会把球面撑出鼓包，
    // 破坏「这是一个完整的球」的观感。
    float isF = 1.0 - step(0.5, abs(aFace - uFocus));
    float lit = isF * uFocusMix * aLand;

    float dist = max(0.6, -mv.z);
    // 陆地点更大；高亮时再放大一档
    float base = aSize * mix(0.62, 1.0, aLand);
    gl_PointSize = base * uSizeScale * uPixelRatio * (30.0 / dist) * (1.0 + lit * 0.7);

    vHue = aHue;
    // 空气透视：远的点淡一些。范围要贴合实际相机距离 ——
    // 相机在 ~19，球面前后是 11.6~26.4，所以取 30→10。
    // 之前用的 42→4 是相机在 26 那版的老参数，会让所有点先掉 25% 亮度。
    vAlpha = 0.72 + smoothstep(30.0, 10.0, dist) * 0.28;
    vFocus = lit;
    vLand = aLand;

    // 边缘度：点的法线（球面上就是自身方向）和视线的夹角。
    // 正对观众时 0，转到球的边缘轮廓处趋近 1 ——
    // 用它做大气边缘光（rim light），球才有体积感而不是一张贴纸。
    //
    // ⚠️ 法线必须转到**世界坐标**再和视线比。aSphere 是局部坐标，
    // 不含球体自身的 yaw/pitch —— 直接拿它点乘世界空间的视线，
    // 球一转两者就不在同一个坐标系里了。实测 yaw=180° 时
    // 82% 的点会被判错，表现是「大洲被切掉一块，转一下才看得到」。
    vec3 nrm = normalize(mat3(modelMatrix) * aSphere);
    vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(pos, 1.0)).xyz);
    vRim = 1.0 - abs(dot(nrm, viewDir));

    float front = step(0.0, dot(nrm, viewDir));

    // 背面的点：法线背离观众。
    // ⚠️ 这里必须**剔除**而不是压暗。曾经用 mix(0.46, 1.0) 只压到一半，
    // 结果背面的大洲整个透过球体显出来 —— 一个实心星球不该看得见背面。
    //
    // 剔除方式：把背面的点挪到裁剪空间外。
    // 比在片元里 discard 便宜 —— 背面的点根本不进光栅化。
    if (front < 0.5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }
  }
`

export const orbFragment = /* glsl */ `
  precision mediump float;

  uniform vec3 uColorA;   // 基色（青）—— 海洋、边缘光
  uniform vec3 uColorB;   // 当前板块的主色，每帧插值，转板块时连续变化
  uniform float uOpacity;

  varying float vHue;
  varying float vAlpha;
  varying float vFocus;
  varying float vLand;
  varying float vRim;

  void main() {
    // 把方形 point sprite 画成圆形光点
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;

    // 中心亮、边缘柔 —— 两段衰减叠加出「核 + 光晕」
    float core = smoothstep(0.5, 0.0, r);
    float halo = smoothstep(0.5, 0.16, r);
    float a = core * 0.55 + halo * 0.45;

    // 底色本身就掺一点当前主色 —— 让「换板块 = 整个场景换调子」
    // 落到所有点上，而不只是高亮那一块。掺 0.35 是上限：
    // 再多的话非高亮的陆地和高亮的分不开，选中感就没了。
    vec3 baseCol = mix(uColorA, uColorB, 0.35);
    vec3 col = mix(baseCol, uColorB, smoothstep(0.8, 1.0, vHue));
    // 高亮大洲整个推到主色并提亮
    col = mix(col, uColorB, vFocus * 0.85);
    col = mix(col, vec3(1.0), vFocus * 0.3);

    // ── 大气边缘光 ──
    // 球的轮廓边缘泛起一层青色辉光，像行星的大气层。
    // 这是让球「有体积」而不是「一片散点」的关键一笔。
    float rim = pow(vRim, 2.4);
    col += mix(uColorA, uColorB, 0.5) * rim * 0.65;

    // ── 衰减 ──
    // ⚠️ 这几个系数是**相乘**的：三个 0.3 叠起来就是 0.027，球会淡到看不见。
    // 曾经取过 (0.3 / 0.62 / 0.28)，结果整个球只有 5–17% 不透明度。
    // 现在每一项都留足下限，最暗的组合（背面的海洋点）也有 ~24%。
    float oceanFade = mix(0.62, 1.0, vLand);   // 海洋是衬托，但要看得见
    float dim = mix(mix(0.82, 1.0, vFocus), 1.0, 1.0 - vLand); // 非高亮陆地略压

    float alpha = a * vAlpha * uOpacity * oceanFade * dim;
    // 边缘光和高亮都会额外提亮
    alpha *= 1.0 + vFocus * 0.6 + rim * 0.5;
    gl_FragColor = vec4(col, alpha);
  }
`

// ── 球体本体 ────────────────────────────────────────────────
//
// 一颗**不透明**的实心球，垫在点云下面（renderOrder −1，先画）。
//
// 为什么需要它：点是加法混合的半透明 sprite，只剔除背面的话球是空的 ——
// 透过「陆地之间的空隙」能直接看到页面背景和背面的大洲，
// 观感是一层壳而不是一颗星球。垫上这颗球后，点云是加在球面上的光。
//
// ⚠️ 别把它改回半透明去做边缘辉光 —— 那样透视问题会原样回来。
// 辉光是外面那层 halo 的事（加法混合、只在轮廓处亮）。

export const bodyVertex = /* glsl */ `
  uniform float uReveal;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;

  void main() {
    vec3 pos = position * uReveal;
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    // 局部坐标（未经旋转）—— 洋流纹理要「长在海面上」跟着球转，
    // 用世界坐标的话球一转纹理会在海面上滑动，像贴纸没贴牢。
    vLocal = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const bodyFragment = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;      // 深海
  uniform vec3 uColorShoal; // 浅海（近岸）
  uniform float uReveal;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;      // 局部坐标 —— 洋流纹理跟着球一起转

  // 便宜的三维噪声：正弦叠加。这里只需要「不规则」，
  // 不值得为一片海引入 Perlin 的代码量。
  //
  // ⚠️ 三个八度的频率比是 1 : 1.4 : 2.5，调用处乘的缩放会整体放大。
  // 用它做海盆时缩放**必须 ≤ 1.0**：p*1.6 会把最高那个八度推到
  // 等效频率 12.3（波长 29°），而一块大洲才 11–14° 宽 ——
  // 那不是海盆，那是一片和大洲同尺度的豹纹斑点，比陆地还抢眼。
  float wave(vec3 p, float t) {
    return sin(p.x * 3.1 + t) * cos(p.y * 2.7 - t * 0.8) * 0.5
         + sin(p.z * 4.3 - t * 1.2) * cos(p.x * 3.9 + t * 0.6) * 0.3
         + sin((p.x + p.z) * 7.7 + t * 1.7) * 0.2;
  }

  /**
   * 海浪 —— 高频的行进波列。
   *
   * ⚠️ 返回的是「脊线」而不是原始正弦和。
   *
   * 踩过的坑：一开始是三个正弦直接相加，然后用 smoothstep(0.35,0.92)
   * 挑波峰。正弦和是**各向同性的光滑场**，只留最高的 5% 得到的是
   * 一堆孤立的椭圆亮斑 —— 逐层出图看过，那是豹纹，不是浪。
   *
   * 浪要有**方向性的长条纹**，得用 ridged 噪声：1−|sin| 的脊线本身
   * 就是沿波前延伸的细线，再把三层不同方向的脊线相乘（而不是相加），
   * 只有三个方向都接近脊时才亮 —— 出来是断续的长浪纹。
   */
  float swell(vec3 p, float t) {
    // 三个**互不平行**的波向量。
    // ⚠️ 方向必须真的岔开：曾经用 (x,z)/(z,y)/(x+y+z) 三组，
    // 它们在球面上的等值线高度相关，叠出来是一圈圈同心环 ——
    // 像指纹，不像海。现在三个方向两两夹角都在 50° 以上。
    float a = 1.0 - abs(sin(dot(p, vec3( 31.0,  7.0, -19.0)) + t * 2.4));
    float b = 1.0 - abs(sin(dot(p, vec3(-13.0, 27.0,  41.0)) - t * 3.1));
    float c = 1.0 - abs(sin(dot(p, vec3( 59.0, -37.0, 23.0)) + t * 4.3));
    // ⚠️ 只能用**乘积**项，不能有单独一层的项。
    // 单个平面波和球面相截就是一组平行的带，正对观众时看着是
    // 一圈圈同心环（像指纹）。两个不同方向的脊线相乘 = 只在
    // 两者交叉处才亮 —— 出来是短促的、朝向各异的浪花，没有主方向。
    return pow(a * b, 2.0) * 0.45 + pow(b * c, 2.0) * 0.33 + pow(a * c, 2.0) * 0.22;
  }

  void main() {
    vec3 n = normalize(vNormal);
    float f = max(0.0, dot(n, normalize(vView)));

    // ── 海水 ──
    // 之前这里是一片死平的深蓝灰，用户说「没把空旷区域变成海洋」。
    // 现在给三样东西：深浅、洋流、阳光反射。
    vec3 p = normalize(vLocal);
    float t = uTime * 0.18;

    // 大尺度的深浅变化 —— 海盆和大陆架。
    // 缩放 0.55：最高八度的等效频率 4.2（波长 85°），
    // 整个球面上只有几块大起伏，是真正的「海盆」尺度。
    float basin = wave(p * 0.55, t * 0.5);
    // 细一档的洋流条纹，流动方向随位置变
    float current = wave(p * 5.5 + vec3(0.0, t * 0.35, 0.0), t);

    // 深浅：只由海盆决定。current 一点都不掺 ——
    // 它等效频率 42（波长 8.5°），掺进底色就是一层噪点。
    float depth = clamp(0.5 + basin * 0.42, 0.0, 1.0);
    vec3 col = mix(uColor, uColorShoal, depth);

    // 洋流的亮纹。
    // ⚠️ 这层踩过两次坑：smoothstep 挑波峰会得到孤立的椭圆亮斑（豹纹），
    // 而 pow(1−|current|, 6) 又会把等值线整个描出来，变成一张
    // 素描似的等高线网。两者都比陆地还抢眼。
    // 洋流只是底纹 —— 用宽而钝的脊（指数 2）并压到 0.06，
    // 只在海面上留一点若隐若现的流向感。
    float crest = pow(1.0 - abs(current), 2.0);
    col += uColorShoal * crest * 0.06;

    // ── 海浪 ──
    // 上面两层都是「海盆 / 洋流」的大尺度，绕球一圈只有几个周期。
    // 真正被看成「浪」的是这一层：波长只有球面的百分之几，在动。
    // ⚠️ swell() 现在返回 0..1 的**脊线强度**（不是有符号的正弦和），
    // 所以这里直接当亮度用，不能再走 smoothstep 挑波峰那一套 ——
    // 那样只会把脊线又切成一串孤立的点。
    float sw = swell(p, t * 5.0);
    col += vec3(0.62, 0.80, 0.92) * sw * 0.30;
    // 浪纹之间的谷压暗一点，起伏才出得来
    col *= 1.0 - (1.0 - sw) * 0.10;

    // ── 阳光反射 ──
    // 假定光从右上方来。海面在那一侧有一片粼粼的反光，
    // 这是「这是水」最直接的信号。
    vec3 sun = normalize(vec3(0.55, 0.62, 0.56));
    float spec = max(0.0, dot(n, sun));
    // 高次幂 → 只有正对光的一小片亮，像镜面
    float glint = pow(spec, 14.0);
    // 反光里也掺波纹，才是「粼粼」而不是一块光斑
    glint *= 0.55 + 0.45 * (current * 0.5 + 0.5);
    col += vec3(0.62, 0.78, 0.86) * glint * 0.5;
    // 加一层很宽的漫反射，让向光面整体亮一点，球才有立体感
    col += uColorShoal * pow(spec, 1.6) * 0.16;

    // 边缘稍亮 —— 球面明暗，不然看着是个平的圆盘
    float rim = pow(1.0 - f, 3.0);
    col += uColor * rim * 1.4;

    // 入场时从页面底色渐变过来。
    // 不能用 alpha 淡入 —— 这个材质是不透明的（就是要挡住背后）。
    col = mix(vec3(0.020, 0.031, 0.059), col, uReveal);

    gl_FragColor = vec4(col, 1.0);
  }
`

// ── 大气辉光外壳 ────────────────────────────────────────────
//
// 套在本体外面的一层，加法混合、只在轮廓处亮。
// 本体是不透明的，边缘会是一条硬边；这层负责把边缘晕开，
// 让球和背景之间有过渡，也是「行星大气」的观感来源。

export const haloVertex = /* glsl */ `
  uniform float uReveal;
  varying vec3 vNormal;
  varying vec3 vView;
  /** 壳上的局部坐标 —— 光带要「长在球面上」跟着球转 */
  varying vec3 vLocal;

  void main() {
    vec3 pos = position * uReveal;
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    /*
      ⚠️ 用局部坐标而不是世界坐标。
      流动的光带要贴在球面上跟着自转一起走；用世界坐标的话
      球一转光带会在表面上滑动，像贴纸没贴牢。
    */
    vLocal = normalize(position);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const haloFragment = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uReveal;
  uniform float uTime;
  /** 高亮强度 0–1 —— 分镜切到新板块时冲一下 */
  uniform float uPulse;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;

  void main() {
    // ⚠️ 这层是 BackSide 渲染的 —— 画的是外壳**远离相机**那半边，
    // 那里法线一律背离相机，dot 恒为负。所以必须取 abs()：
    // 用 max(0.0, dot) 的话 f 恒为 0、rim 恒为 1，整个球会被糊上
    // 一层满亮的青色加法光，大洲和琥珀色高亮全被冲掉
    //（踩过一次：症状是「板块看不全 / 没有高亮」）。
    float f = abs(dot(normalize(vNormal), normalize(vView)));

    /*
      指数拉高：只有接近轮廓的一圈才亮（那里 f→0），
      球心方向 f→1 完全不加东西，否则陆地的对比度就没了。

      ⚠️ 指数从 4.0 降到 2.5。原来衰减太陡 —— 实测球缘(d=1.0)处
      alpha 只有 0.18，真正亮的那圈落在球**外**的 1.03–1.06，
      而那里本来就很淡，所以「轮廓不明显」。
      2.5 时球缘 alpha 到 0.37（翻倍），球心污染仍只有 0.0003，
      不会糊住陆地。
    */
    float rim = pow(1.0 - f, 2.5);

    /*
      ── 实心光环 ──
      一圈**均匀满亮**的光环，不是从内往外渐亮的雾。

      ⚠️ 关键在**两侧都要收口**。
      单向的 smoothstep(0.52, 0.20) 是一条斜坡：越靠外越亮，
      在 d=0.95 处只有 0.14、d=1.06 才到 1.0 —— 那读出来是一团
      逐渐变浓的雾，不是环。
      实心环要「进了环带就满亮，出了环带迅速归零」：
        内缘 smoothstep(0.58, 0.42) 从球内侧升起
        外缘 smoothstep(0.03, 0.14) 在壳最外缘之前收住
      两者相乘，中间那段恒为 1，就是实心的一圈。

      壳在 1.06R，球的实际边界 d=1.0 对应 f≈0.33 —— 环带正好
      骑在这个位置上（满亮区 d≈0.96–1.05），勾的是球的真实轮廓。

      ⚠️ 宽度要按**首页的大球**定。首页球半径 448px，是板块内
      (152px) 的三倍；窄环在大球上摊到 2800px 的周长会显得像根细线。
      当前参数在首页给出约 43px 的实心环，起点 d=0.88 —— 再往内
      就会压到陆地上了。
    */
    float ringIn = smoothstep(0.58, 0.42, f);
    float ringOut = smoothstep(0.03, 0.14, f);
    float edge = ringIn * ringOut;

    /*
      ── 定向光：让球有「体」而不是一个圆片 ──

      ⚠️ 这是整个边缘光的**要点**。均匀亮一圈的轮廓恰恰会把球压平 ——
      现实里没有哪个球体是四周等亮的，那是圆片的特征。
      太阳打在球上时向光的一侧边缘最亮、背光侧几乎只剩一线暗光，
      正是这个不对称让眼睛读出「这是个球」。

      光源方向和本体的高光保持一致（bodyFragment 里的 sun），
      否则表面的粼粼反光在左上、轮廓的亮边在右下，两个光源打架。
    */
    vec3 sun = normalize(vec3(0.55, 0.62, 0.56));
    /*
      ⚠️ 用**世界法线** vNormal，不是局部坐标 vLocal。
      光源是固定在世界空间的（太阳不会跟着地球转）。用 vLocal 的话
      明暗面会钉在球面上跟着自转走 —— 那不是光照，是一块贴上去的
      阴影贴图，球转起来立刻穿帮。
      本体的高光也是用世界法线 n 算的（见 bodyFragment），两者必须一致。
    */
    float lit = dot(normalize(vNormal), sun);
    // 向光面 1、背光面 0，中间是柔和的明暗交界（terminator）
    float dayNight = smoothstep(-0.35, 0.55, lit);

    /*
      ── 日冕：向光侧的耀斑 ──
      沿轮廓分布的细密条纹，只在向光一侧出现，慢慢游走。
      这是「恒星表面」的观感来源，也让亮边不是一条死板的线。
      ⚠️ 频率不能低：低频会变成整体明暗（试过 2.4，只有 0.76 个
      周期，看着是球在忽明忽暗而不是有耀斑）。
      ⚠️ 这里用 vLocal 是**对的** —— 耀斑是球面本身的特征，
      应该跟着自转一起走；而上面的明暗面用世界法线，是外部光源。
    */
    float flare = sin(vLocal.y * 9.0 - uTime * 1.1) * 0.5 + 0.5;
    flare = pow(flare, 2.4) * dayNight;

    /*
      ── 呼吸 ──
      很慢的整体起伏，让光「活着」。幅度只有 ±10%，再大就成了闪烁。
    */
    float breathe = 0.9 + 0.1 * sin(uTime * 0.6);

    /*
      ── 切板块时的冲击 ──
      uPulse 由 CPU 在分镜切换时置 1 再衰减到 0（见 OrbScene）。
    */
    float burst = uPulse * 0.7;

    /*
      合成。
      · 背光侧保留 0.22 的底 —— 完全黑掉的话球的另外半边就「没了」，
        看不出完整的轮廓；留一线暗光才是「被照亮的球」而不是「半个球」。
      · 向光侧叠日冕和冲击。
    */
    float dir = 0.22 + dayNight * 0.78;

    float glow = rim * dir + edge * (0.5 * dir + flare * 0.5 + burst);
    vec3 col = uColor * (rim * 1.8 * dir + edge * (1.0 * dir + flare * 0.9 + burst));
    // 向光侧的最亮处推向白 —— 恒星边缘的过曝感
    col += vec3(1.0) * edge * flare * 0.35;

    float a = glow * breathe * uReveal;
    gl_FragColor = vec4(col, min(a, 1.0));
  }
`

// ── 线条（海岸线 / 经纬网）──────────────────────────────────

export const lineVertex = /* glsl */ `
  attribute vec3 aSphere;
  attribute float aFace;

  uniform float uReveal;
  uniform float uFocus;
  uniform float uFocusMix;

  varying float vFade;
  varying float vFocus;

  void main() {
    vec3 pos = aSphere * uReveal;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // 背面的线更淡 —— 没有深度测试时，靠这个区分正背面
    float dist = max(0.6, -mv.z);
    vFade = smoothstep(40.0, 8.0, dist);

    // 法线朝向：背面的线直接剔除。
    // 压暗（试过 0.4）是不够的 —— 背面的海岸线仍会透过球体显出来，
    // 一眼就看出这是个空壳而不是实心星球。
    //
    // ⚠️ 和点云同一个坑：法线要先乘 modelMatrix 转到世界坐标。
    // 用局部的 aSphere 的话，球转起来剔除的就不是真正的背面。
    vec3 nrm = normalize(mat3(modelMatrix) * aSphere);
    vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(pos, 1.0)).xyz);
    float front = dot(nrm, viewDir);

    // 靠近轮廓处（front 接近 0）渐隐，不然剔除的边界是一条硬切线，
    // 看着像球被刀削了一半。0.06 是「看不出接缝」的最小过渡带。
    vFade *= smoothstep(0.0, 0.06, front);

    float isF = 1.0 - step(0.5, abs(aFace - uFocus));
    vFocus = isF * uFocusMix;

    if (front < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }
  }
`

export const lineFragment = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform vec3 uFocusColor;
  uniform float uOpacity;
  varying float vFade;
  varying float vFocus;

  void main() {
    vec3 col = mix(uColor, uFocusColor, vFocus);
    // 高亮大洲的海岸线明显更亮 —— 这是「这块被选中」最清晰的信号
    gl_FragColor = vec4(col, vFade * uOpacity * (1.0 + vFocus * 3.0));
  }
`

// ── 海洋上的数据流弧线 ────────────────────────────────────────
//
// 洲际之间的大圆弧，弧上有个亮点在跑 —— 「数据在两块大陆之间流动」。
// 弧线本体很淡（只是底纹），真正被看见的是跑动的亮点。

export const flowVertex = /* glsl */ `
  attribute vec3 aSphere;
  attribute float aT;      // 在整条弧上的位置 0–1
  attribute float aFace;   // 这条弧从哪块大洲出发

  uniform float uReveal;
  uniform float uFocus;

  varying float vT;
  varying float vFocus;
  varying float vFade;

  void main() {
    vec3 pos = aSphere * uReveal;
    vec4 world = modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;

    // 背面剔除 —— 和点云 / 海岸线同一套判据（法线要转到世界坐标！）
    vec3 nrm = normalize(mat3(modelMatrix) * aSphere);
    vec3 viewDir = normalize(cameraPosition - world.xyz);
    float front = dot(nrm, viewDir);
    // 轮廓附近渐隐，不然剔除边界是一条硬切线
    vFade = smoothstep(0.0, 0.08, front);
    if (front < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }

    vT = aT;
    vFocus = 1.0 - step(0.5, abs(aFace - uFocus));
  }
`

export const flowFragment = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vT;
  varying float vFocus;
  varying float vFade;

  void main() {
    // 沿弧行进的亮点。三个一组、相位错开，弧上始终有东西在跑。
    // 速度比之前快一档（0.13 → 0.2），慢了看着像没动。
    float phase = fract(vT - uTime * 0.2);

    // 每个亮点是「短促的头 + 拖在后面的尾」，方向感才出得来。
    // 纯对称的点看不出往哪边跑。
    float pulse = 0.0;
    for (int i = 0; i < 3; i++) {
      float o = fract(phase - float(i) * 0.333);
      // 头：前 5% 内急升；尾：往后 22% 缓降
      pulse += smoothstep(0.0, 0.05, o) * smoothstep(0.27, 0.05, o);
    }
    pulse = clamp(pulse, 0.0, 1.0);

    // 弧线本体是淡底纹 —— 太亮会变成一张网把球罩住。
    // 从高亮那块出发的弧整体亮一大档：转到哪块，哪几条链路「通电」。
    float base = 0.16 + vFocus * 0.3;
    float a = (base + pulse * (1.1 + vFocus * 0.7)) * uOpacity * vFade;

    // 亮点处推向白，像真的有能量经过，而不只是变亮的同色
    vec3 col = mix(uColor, vec3(1.0), pulse * 0.55);
    gl_FragColor = vec4(col * (1.0 + pulse * 1.6), a);
  }
`

// ── 海面居民（船只 / 海洋生物）────────────────────────────────
//
// 每个个体沿自己的**大圆航线**漂移：位置 = origin 绕 (origin×heading) 旋转。
// 旋转全在 GPU 算，CPU 每帧只更新一个 uTime，不碰 buffer。
//
// 精灵朝向：point sprite 本身不能旋转，所以在片元里对 gl_PointCoord
// 做二维旋转，让图标转到航向上（图集里画的一律朝右）。

export const lifeVertex = /* glsl */ `
  attribute vec3 aOrigin;    // 出发点（单位向量）
  attribute vec3 aHeading;   // 航向（切向单位向量）
  attribute float aKind;     // 图集格子号
  attribute float aSeed;

  uniform float uTime;
  uniform float uReveal;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uRadius;

  varying float vKind;
  varying float vAngle;   // 航向在屏幕上的角度，片元据此旋转图标
  varying float vFade;
  varying float vSeed;

  void main() {
    // 绕 axis = origin × heading 旋转，就是沿大圆前进。
    // 速度带个体差异，否则所有船整齐划一像阅兵。
    vec3 axis = normalize(cross(aOrigin, aHeading));
    float speed = 0.012 + aSeed * 0.018;
    float ang = uTime * speed + aSeed * 6.28;

    // 罗德里格旋转公式
    float c = cos(ang);
    float sn = sin(ang);
    vec3 p = aOrigin * c + cross(axis, aOrigin) * sn + axis * dot(axis, aOrigin) * (1.0 - c);

    // 当前的前进方向（航线的切向）—— 图标要转到这个方向上
    vec3 fwd = normalize(cross(axis, p));

    vec3 world = p * uRadius * uReveal;
    vec4 wp = modelMatrix * vec4(world, 1.0);
    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;

    // 背面剔除 —— 和其它层同一套判据（法线转世界坐标）
    vec3 nrm = normalize(mat3(modelMatrix) * p);
    vec3 viewDir = normalize(cameraPosition - wp.xyz);
    float front = dot(nrm, viewDir);
    // 接近轮廓时渐隐，不然船会在球边缘「啪」地消失
    vFade = smoothstep(0.02, 0.22, front) * uReveal;
    if (front < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }

    // 航向投影到屏幕：把 p 和 p+fwd 都投影，看屏幕上的方向
    vec4 tipClip = projectionMatrix * viewMatrix * modelMatrix
      * vec4((p + fwd * 0.06) * uRadius * uReveal, 1.0);
    vec2 a = gl_Position.xy / max(1e-4, gl_Position.w);
    vec2 b = tipClip.xy / max(1e-4, tipClip.w);
    vAngle = atan(b.y - a.y, b.x - a.x);

    float dist = max(0.6, -mv.z);
    // ── 尺寸 ──
    // 真实比例下这些全都小于 1px（1px≈14km，航母才 330m），所以是
    // 刻意放大的装饰画 —— 但**彼此之间**的大小关系必须守住用户给的序：
    //   航母 > 货轮 > 鲸鱼 > 军舰 > 鲨鱼 > 渔船 > 鱼
    // ⚠️ 上一版把小鱼群给到 9.0、渔船 8.5，排序反了（鱼比渔船大）。
    // 现在严格单调，每档之间至少差 0.8，缩到屏幕上仍分得出层次。
    float sz = 5.0;                        // 小鱼群（最小）
    if (aKind < 0.5)      sz = 10.5;       // 货轮
    else if (aKind < 1.5) sz = 12.0;       // 航母（最大）
    else if (aKind < 2.5) sz = 8.2;        // 军舰
    else if (aKind < 3.5) sz = 7.0;        // 渔船
    else if (aKind < 4.5) sz = 9.2;        // 鲸鱼
    else if (aKind < 5.5) sz = 7.8;        // 鲨鱼
    else if (aKind < 6.5) sz = 6.0;        // 大鱼
    gl_PointSize = sz * uSizeScale * uPixelRatio * (30.0 / dist);

    vKind = aKind;
    vSeed = aSeed;
  }
`

export const lifeFragment = /* glsl */ `
  precision mediump float;

  uniform sampler2D uAtlas;
  uniform vec2 uAtlasGrid;   // (列数, 行数)
  uniform vec3 uColor;
  uniform float uTime;

  varying float vKind;
  varying float vAngle;
  varying float vFade;
  varying float vSeed;

  void main() {
    // 把 point sprite 的坐标绕中心转到航向上。
    // 图集里所有图标都画成朝右(+x)，所以这里转 -vAngle。
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(-vAngle);
    float s = sin(-vAngle);
    uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    // 转完可能超出 [-0.5,0.5]，超了就丢弃 —— 否则会采到相邻格子
    if (abs(uv.x) > 0.5 || abs(uv.y) > 0.5) discard;

    // 定位到图集里的格子
    float col = mod(vKind, uAtlasGrid.x);
    float row = floor(vKind / uAtlasGrid.x);
    vec2 cell = (uv + 0.5) / uAtlasGrid;
    vec2 at = cell + vec2(col, row) / uAtlasGrid;
    // Y 轴翻转 —— canvas 的原点在左上，纹理的在左下
    at.y = 1.0 - at.y;

    vec4 tex = texture2D(uAtlas, at);
    if (tex.a < 0.04) discard;

    // 海洋生物做「起伏」：亮度随时间脉动，像在水里时隐时现。
    // 船不做 —— 船是稳定航行的。
    float bob = vKind >= 4.0
      ? 0.55 + 0.45 * sin(uTime * 1.3 + vSeed * 6.28)
      : 1.0;

    gl_FragColor = vec4(uColor, tex.a * vFade * bob * 0.9);
  }
`

// ── 点击海面触发的事件（台风 / 火山 / 龙卷风）────────────────
//
// 每个事件是一小片以命中点为中心的网格（局部切平面上的圆盘）。
// 三种效果共用同一套顶点，靠 uType 在片元里分流 —— 一次 draw call。
//
// 生命周期由 uAge（0→1）驱动，跑完自动回收（CPU 侧不再上传）。

export const eventVertex = /* glsl */ `
  attribute vec2 aGrid;      // 圆盘内的局部坐标 −1..1
  attribute float aSlot;     // 属于第几个事件

  uniform float uTime;
  // 每个槽位一组参数。⚠️ 这里的 14 必须和 OrbScene 的 EVENT_SLOTS
  // 完全一致 —— 对不上的话越界的槽会读到垃圾值，或者干脆链接失败。
  uniform vec3 uCenter[14];   // 命中点（单位向量）
  uniform vec3 uTanU[14];     // 切平面基 1
  uniform vec3 uTanV[14];     // 切平面基 2
  uniform float uAge[14];     // 0→1，>=1 表示这个槽是空的
  uniform float uType[14];    // 0 台风 / 1 火山 / 2 龙卷风
  uniform float uRadius;

  varying vec2 vGrid;
  varying float vAge;
  varying float vType;
  varying float vFade;

  void main() {
    int idx = int(aSlot + 0.5);
    // GLSL ES 1.0 不支持变量索引 uniform 数组，只能展开
    vec3 c = vec3(0.0), tu = vec3(0.0), tv = vec3(0.0);
    float age = 2.0, ty = 0.0;
    for (int i = 0; i < 14; i++) {
      if (i == idx) {
        c = uCenter[i]; tu = uTanU[i]; tv = uTanV[i];
        age = uAge[i]; ty = uType[i];
      }
    }

    vAge = age;
    vType = ty;
    vGrid = aGrid;

    // 空槽：挪出裁剪空间，不画
    if (age >= 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    // ── 圆盘半径 ──
    // ⚠️ 这里的 grow 不是「屏幕比例」，是**切平面上的偏移量**：
    // p = normalize(c + tangent * grow)，所以真实角半径 = atan(grow)。
    // 曾经写成 (0.25 + age*1.9)*0.5 → grow=1.075 → atan = **47°**，
    // 而一块大洲的主核才 12–14°。结果台风比整块大陆还大三倍，
    // 六个槽位叠加法混合直接把海面和船全糊掉了。
    //
    // 现在按真实尺度反推：台风直径约 500–1000km，地球半周 20000km/180°
    // → 半径 250–500km ≈ 2.2–4.5°。取 tan(4.9°)=0.086 作上限。
    // 火山口和龙卷风比台风小一个量级，各自再收一档。
    float maxR = ty < 0.5 ? 0.086 : (ty < 1.5 ? 0.052 : 0.038);
    // 从两成半的大小长到满，而不是从 0 —— 从 0 长会有一帧的针尖状
    float grow = maxR * (0.25 + 0.75 * age);

    // 贴在球面上：中心点 + 切平面内的偏移，再归一化回球面
    vec3 p = normalize(c + (tu * aGrid.x + tv * aGrid.y) * grow);
    // 火山和龙卷风要往外「长高」，台风贴着海面。
    // 抬升量也跟着盘子一起缩 —— 原来的 0.10/0.14 是按巨盘配的，
    // 盘子缩到 1/12 后还抬那么高，会变成一根戳出球面的钉子。
    float lift = ty < 0.5
      ? 0.0
      : (1.0 - length(aGrid)) * (ty < 1.5 ? 0.016 : 0.024) * sin(age * 3.1416);

    vec4 wp = modelMatrix * vec4(p * uRadius * (1.0 + lift), 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;

    // 背面剔除
    vec3 nrm = normalize(mat3(modelMatrix) * p);
    vec3 viewDir = normalize(cameraPosition - wp.xyz);
    float front = dot(nrm, viewDir);
    vFade = smoothstep(0.0, 0.18, front);
    if (front < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }
  }
`

export const eventFragment = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform vec3 uColorA;   // 冷色（台风 / 龙卷风）
  uniform vec3 uColorB;   // 暖色（火山）

  varying vec2 vGrid;
  varying float vAge;
  varying float vType;
  varying float vFade;

  void main() {
    if (vAge >= 1.0) discard;

    float r = length(vGrid);
    if (r > 1.0) discard;

    float ang = atan(vGrid.y, vGrid.x);
    // 整体的生灭包络：起手快、收尾慢
    float life = smoothstep(0.0, 0.08, vAge) * smoothstep(1.0, 0.45, vAge);

    float a = 0.0;
    vec3 col = uColorA;

    if (vType < 0.5) {
      // ── 台风：旋臂 + 中心风眼 ──
      // 螺旋线：极角随半径偏移，就是阿基米德螺线。
      // ⚠️ 径向频率跟着盘子一起降过（9.0 → 3.2）。盘子从 328px 缩到
      // 38px 后，原来的 9 个周期挤在 38px 里只会糊成摩尔纹噪点。
      // 现在两条旋臂绕不到一圈半 —— 小尺寸下才认得出是台风。
      float arms = sin(ang * 2.0 - r * 3.2 + uTime * 2.4) * 0.5 + 0.5;
      arms = pow(arms, 1.7);
      // 风眼：中心挖空
      float eye = smoothstep(0.10, 0.24, r);
      // 外缘渐隐
      float edge = smoothstep(1.0, 0.55, r);
      a = arms * eye * edge * 0.95;
      col = uColorA;
    } else if (vType < 1.5) {
      // ── 火山：中心炽热 + 向外抛射的碎屑 ──
      float core = smoothstep(0.34, 0.0, r);
      // 放射状的喷射条纹（9 → 5 条，同上：小尺寸下条纹要疏）
      float rays = sin(ang * 5.0 + uTime * 1.6) * 0.5 + 0.5;
      float burst = smoothstep(0.9, 0.15, r) * pow(rays, 2.2) * 0.6;
      a = (core * 1.1 + burst) * 0.95;
      // 中心白热，往外转到暖橙
      col = mix(uColorB, vec3(1.0, 0.96, 0.85), core * 0.8);
    } else {
      // ── 龙卷风：细长的漏斗，绕着转 ──
      // 越靠中心越密：用角向条纹 + 强烈的中心收束
      // （径向 14.0 → 5.0，17px 的盘子塞不下 14 个周期）
      float swirl = sin(ang * 3.0 + r * 5.0 - uTime * 5.0) * 0.5 + 0.5;
      float funnel = smoothstep(0.62, 0.02, r);
      a = pow(swirl, 1.5) * funnel * 1.0;
      col = mix(uColorA, vec3(1.0), funnel * 0.45);
    }

    gl_FragColor = vec4(col, a * life * vFade);
  }
`

// ── 大洲内的弧形照片 ──────────────────────────────────────
//
// 每块大洲底下贴一张照片，弯成球面的一段弧。
//
// ⚠️ 半径必须落在 0.986–0.999 之间：实心本体在 0.985 且**不透明**，
// 比它小的一律看不见；点云在 1.0 以上。照片夹在这层缝里，
// 于是文字笔画的空隙处会透出照片，笔画本身盖住它。
//
// 顶点全部在着色器里算：给定大洲中心的经纬和跨度，把网格的
// (u,v) 映射成球面方向。CPU 只传中心和跨度，不生成几何。

export const photoVertex = /* glsl */ `
  attribute vec2 aGrid;      // 网格内的局部坐标 0..1

  // ── 鼠标放大镜 ──
  // ⚠️ 只有照片这一层做。用户明确说过要放大的是球面上的这张背景图，
  // 不是点云文字和海岸线（那两样跟着变形像画面坏了）。
  uniform vec3 uLensDir;   // 镜心方向（局部坐标，单位向量）
  uniform float uLensAmt;  // 0 = 关，1 = 全开（移入移出时缓动）
  uniform float uLensR;    // 镜区角半径（弧度）
  uniform float uLensM;    // 镜心处的放大倍率

  uniform float uReveal;
  uniform float uRadius;
  uniform vec3 uCenter;      // 大洲中心方向（单位向量）
  uniform vec3 uTanU;        // 切平面基 1（经度方向）
  uniform vec3 uTanV;        // 切平面基 2（纬度方向）
  uniform float uHalfU;      // 经度半跨（弧度）
  uniform float uHalfV;      // 纬度半跨（弧度）

  varying vec2 vUv;
  varying float vFade;
  varying float vLensK;

  /**
   * 球面鱼眼：把镜心附近的顶点沿球面推开 —— uv 不动，图就被拉大了。
   *
   * ⚠️ 只改**方向**不改半径：半径一动照片就鼓出球面，
   * 会穿到点云上面去（各层半径是排好序的）。
   *
   * ⚠️ 用位移而不是在片元里反解 uv。片元反解更平滑，但那要往
   * 片元着色器里塞进 9 个 uniform、一个带 out 参数的函数和牛顿迭代 ——
   * 这台机器上没有 WebGL 可以验证，出问题就是整张图不显示。
   * 位移写法和点云 / 海岸线 / 船那几层是同一个套路，是跑通过的。
   * 代价是精度等于网格密度，所以 buildPhotos 把网格从 24×16 加密到了 96×64。
   */
  vec3 lensWarp(vec3 p, out float k) {
    k = 0.0;
    if (uLensAmt < 0.002) return p;

    float ca = clamp(dot(p, uLensDir), -1.0, 1.0);
    float a = acos(ca);            // 该点到镜心的球面角距
    if (a >= uLensR) return p;     // 镜区外：一点不动

    float M = mix(1.0, uLensM, uLensAmt);
    float x = a / uLensR;
    /*
      三次曲线 f(x) = M·x + (2−2M)·x² + (M−1)·x³
      解自 f(0)=0、f'(0)=M、f(1)=1、f'(1)=1 ——
      镜心放大 M 倍，到镜区边界时位置和缩放率都接回原样，所以没有接缝。
      M ≤ 2.5 时 f' 恒正，不会自交折叠。
    */
    float f = M * x + (2.0 - 2.0 * M) * x * x + (M - 1.0) * x * x * x;
    float a2 = f * uLensR;

    // 从镜心指向该点的切向 —— 沿着它把点推到新的角距
    vec3 t = p - uLensDir * ca;
    float st = length(t);
    if (st < 0.00001) return p;    // 正好在镜心上，没有切向可言
    vec3 u = t / st;

    k = (1.0 - x) * uLensAmt;
    return uLensDir * cos(a2) + u * sin(a2);
  }

  void main() {
    vUv = aGrid;

    // 把 (u,v) 映射到 [-half, +half] 的角度，再绕两个切轴转出球面点。
    // ⚠️ 不能简单地在切平面上偏移再归一化 —— 那样跨度大时边缘会被
    // 挤压（切平面是平的，球面是弯的）。按角度旋转才是等距的。
    float au = (aGrid.x - 0.5) * 2.0 * uHalfU;
    float av = (aGrid.y - 0.5) * 2.0 * uHalfV;

    vec3 p = normalize(
      uCenter * (cos(au) * cos(av))
      + uTanU * (sin(au) * cos(av))
      + uTanV * sin(av)
    );

    // 放大镜：镜区内的顶点被推开，uv 不动 —— 于是这块图被拉大了
    p = lensWarp(p, vLensK);

    vec4 wp = modelMatrix * vec4(p * uRadius * uReveal, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;

    // 背面剔除 + 轮廓处渐隐，和其它层同一套判据
    vec3 nrm = normalize(mat3(modelMatrix) * p);
    vec3 viewDir = normalize(cameraPosition - wp.xyz);
    float front = dot(nrm, viewDir);
    /*
      正面度渐隐。
      ⚠️ 阈值 0.25 → 0.12：照片钉在大洲上，手动拖拽后可能停在
      相机侧前方（front ≈ 0.1–0.2），0.25 的阈值会让它淡到只剩
      三成亮度，看着像「图没加载出来」。
      放宽到 0.12 后，只有真正转到侧后方才开始收，
      正面附近全程满亮。
    */
    vFade = smoothstep(0.0, 0.12, front) * uReveal;
    if (front < 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }
  }
`

export const photoFragment = /* glsl */ `
  precision mediump float;

  uniform sampler2D uMap;    // 当前这张
  uniform sampler2D uMapB;   // 上一张 —— 切换时从它淡出
  uniform float uMix;        // 0 = 完全显示上一张，1 = 完全是当前这张
  uniform float uOpacity;
  uniform vec3 uTint;

  varying vec2 vUv;
  varying float vFade;
  varying float vLensK;      // 镜区强度 1（镜心）→ 0（镜外），顶点算好传下来

  void main() {
    /*
      ⚠️ **不要**翻转 Y。

      切基是 tu = up × c、tv = c × tu，代入 c=(0,0,1)、up=(0,1,0) 得
      tu=(1,0,0)（屏幕右）、tv=(0,1,0)（屏幕上）——
      也就是 aGrid.y 增大时点往**屏幕上方**走。
      而 three.js 的 TextureLoader 默认 flipY=true，纹理 v=1 已经
      对应图片顶部。两者已经一致，再翻一次就上下颠倒了。
      （这和 canvas 手绘纹理的情形不同 —— 那里要翻。）
    */
    /*
      两张交叉淡入。
      ⚠️ 不能只对最终颜色做 alpha 过渡 —— 那样中间态是「半透明的新图
      叠在半透明的旧图上」，两张都能看见，很脏。
      在**采样阶段**混合，任何时刻都只有一张有效的颜色。
    */
    vec4 texA = texture2D(uMap, vUv);
    vec4 texB = texture2D(uMapB, vUv);
    vec4 tex = mix(texB, texA, uMix);

    // 边缘柔化 —— 硬边会让照片看着像一张贴上去的邮票。
    // 四边各留 12% 做渐隐，融进周围的点云里。
    float ex = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    float ey = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
    float edge = ex * ey;

    // 掺一点板块主色 —— 照片是嵌在星球里的，不该是一块突兀的原色矩形
    vec3 col = mix(tex.rgb, tex.rgb * uTint * 1.6, 0.35);

    // 放大镜底下让照片本来的颜色多露一点、亮一档 ——
    // 它平时只有 45% 不透明度又压在点云文字下面，单放大很难看出来
    col = mix(col, tex.rgb, vLensK * 0.5);

    gl_FragColor = vec4(col, tex.a * edge * vFade * uOpacity * (1.0 + vLensK * 0.6));
  }
`

