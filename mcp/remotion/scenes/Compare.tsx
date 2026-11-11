import React from "react";
import { fitSize, rgba, useEnter, type Box, type SceneData, type VideoProps } from "../theme";

const Side: React.FC<{ side: { heading: string; items: string[] }; delay: number; p: VideoProps; box: Box; w: number; h: number; accent: boolean }> = ({ side, delay, p, box, w, h, accent }) => {
  const { theme, motion } = p;
  const e = useEnter(delay, motion.damping);
  const headSize = fitSize(side.heading, w - 64, h * 0.2, 58, 28, 1.1);
  const itemSize = Math.min(...side.items.map((t) => fitSize(t, w - 100, (h * 0.7) / Math.max(side.items.length, 1) - 18, 44, 22, 1.2)), 44);
  return (
    <div
      style={{
        width: w, height: h, boxSizing: "border-box", padding: 32, borderRadius: 28, background: rgba(theme.foreground, 0.07),
        border: `3px solid ${accent ? theme.accent : rgba(theme.foreground, 0.18)}`, opacity: e, transform: `translateY(${(1 - e) * motion.travel}px)`,
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: headSize, fontWeight: 800, color: accent ? theme.accent : theme.foreground, marginBottom: 20, lineHeight: 1.1 }}>{side.heading}</div>
      {side.items.map((t, i) => (
        <div key={i} style={{ fontSize: itemSize, lineHeight: 1.2, marginBottom: 14, fontWeight: 500, display: "flex", gap: 14 }}>
          <span style={{ color: theme.accent }}>•</span>
          <span style={{ minWidth: 0, overflowWrap: "break-word" }}>{t}</span>
        </div>
      ))}
    </div>
  );
};

export const Compare: React.FC<{ s: SceneData; p: VideoProps; box: Box }> = ({ s, p, box }) => {
  const gap = 36;
  const head = s.heading ?? "";
  const headSize = head ? fitSize(head, box.cw, box.ch * 0.14, 64, 30, 1.1) : 0;
  const avail = box.ch - (head ? headSize * 1.1 + 36 : 0);
  const w = box.vertical ? box.cw : (box.cw - gap) / 2;
  const h = box.vertical ? (avail - gap) / 2 : avail;
  return (
    <div>
      {head ? <div style={{ fontSize: headSize, fontWeight: 800, marginBottom: 36, lineHeight: 1.1 }}>{head}</div> : null}
      <div style={{ display: "flex", flexDirection: box.vertical ? "column" : "row", gap }}>
        {s.left ? <Side side={s.left} delay={6} p={p} box={box} w={w} h={h} accent={false} /> : null}
        {s.right ? <Side side={s.right} delay={16} p={p} box={box} w={w} h={h} accent /> : null}
      </div>
    </div>
  );
};
