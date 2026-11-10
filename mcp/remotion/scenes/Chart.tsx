import React from "react";
import { fitSize, rgba, useEnter, type Box, type SceneData, type VideoProps } from "../theme";

const fmt = (n: number): string => (Math.abs(n) >= 100 ? Math.round(n).toLocaleString("en-US") : String(Math.round(n * 100) / 100));

export const Chart: React.FC<{ s: SceneData; p: VideoProps; box: Box }> = ({ s, p, box }) => {
  const bars = s.chart?.bars ?? [];
  const unit = s.chart?.unit ?? "";
  const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1e-9);
  const head = s.heading ?? "";
  const headSize = head ? fitSize(head, box.cw, box.ch * 0.14, 64, 30, 1.1) : 0;
  const rowH = Math.min(96, (box.ch - (head ? headSize * 1.1 + 40 : 0)) / Math.max(bars.length, 1) - 16);
  const labelW = Math.min(box.cw * 0.3, 420);
  const valueW = Math.min(box.cw * 0.2, 260);
  const trackW = box.cw - labelW - valueW - 40;
  const labelSize = Math.min(...bars.map((b) => fitSize(b.label, labelW, rowH, 40, 20, 1.1)), 40);
  return (
    <div>
      {head ? <div style={{ fontSize: headSize, fontWeight: 800, marginBottom: 40, lineHeight: 1.1 }}>{head}</div> : null}
      {bars.map((b, i) => (
        <BarRow key={i} i={i} bar={b} unit={unit} max={max} rowH={rowH} labelW={labelW} valueW={valueW} trackW={trackW} labelSize={labelSize} p={p} />
      ))}
    </div>
  );
};

const BarRow: React.FC<{ i: number; bar: { label: string; value: number }; unit: string; max: number; rowH: number; labelW: number; valueW: number; trackW: number; labelSize: number; p: VideoProps }> = (r) => {
  const { theme, motion } = r.p;
  const e = useEnter(8 + Math.round(r.i * motion.stagger * 20), motion.damping + 4);
  const w = Math.max(6, (Math.abs(r.bar.value) / r.max) * r.trackW * e);
  const valueText = `${fmt(r.bar.value)}${r.unit ? " " + r.unit : ""}`;
  return (
    <div style={{ display: "flex", alignItems: "center", height: r.rowH, marginBottom: 16, gap: 20 }}>
      <div style={{ width: r.labelW, fontSize: r.labelSize, fontWeight: 600, textAlign: "right", lineHeight: 1.1, overflowWrap: "break-word" }}>{r.bar.label}</div>
      <div style={{ width: r.trackW, height: r.rowH * 0.62, background: rgba(theme.foreground, 0.08), borderRadius: 12 }}>
        <div style={{ width: w, height: "100%", borderRadius: 12, background: theme.accent }} />
      </div>
      <div style={{ width: r.valueW, fontSize: fitSize(valueText, r.valueW, r.rowH, 40, 18, 1.1), fontWeight: 800, opacity: e, color: theme.foreground, lineHeight: 1.1 }}>{valueText}</div>
    </div>
  );
};
