// Web Audio API 合成提示音（不依赖外部 mp3 文件）
// 浏览器自动播放策略：AudioContext 需在用户手势中创建/恢复，
// 因此在"开始"按钮点击时调用 primeAudio() 预热，倒计时结束时即可直接发声。

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

/** 在用户手势（如点击"开始"）时调用，预热音频上下文 */
export function primeAudio(): void {
  getCtx();
}

/** 倒计时结束提示音：三声 880Hz 短 beep（各 0.15s，间隔 0.2s） */
export function playDoneSound(): void {
  const c = getCtx();
  if (!c) return;

  for (let i = 0; i < 3; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;

    const t0 = c.currentTime + i * 0.35;
    // 音量包络：快速起音 + 指数衰减，避免爆音
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }
}
