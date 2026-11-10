import React from "react";
import { fitSize, rgba, useEnter, type Box, type SceneData, type VideoProps } from "../theme";

export const End: React.FC<{ s: SceneData; p: VideoProps; box: Box }> = ({ s, p, box }) => {
  const { theme, motion, labels, sources } = p;
  const a = useEnter(4, motion.damping);
  const rowSize = Math.min(...sources.map((x) => fitSize(`${x.publisher}: ${x.title}`, box.cw, 56, 34, 20, 1.15)), 34);
  return (
    <div style={{ opacity: a, transform: `translateY(${(1 - a) * motion.travel * 0.5}px)` }}>
      {sources.length ? (
        <>
          <div style={{ fontSize: 30, letterSpacing: 4, textTransform: "uppercase", color: theme.accent, fontWeight: 800, marginBottom: 20 }}>Sources</div>
          {sources.map((x, i) => (
            <div key={i} style={{ fontSize: rowSize, lineHeight: 1.2, marginBottom: 12, display: "flex", gap: 14 }}>
              <span style={{ fontWeight: 800, flex: "none" }}>{x.publisher}</span>
              <span style={{ color: theme.muted, minWidth: 0, overflowWrap: "break-word" }}>{x.title}</span>
            </div>
          ))}
        </>
      ) : null}
      <div style={{ marginTop: 44, paddingTop: 24, borderTop: `2px solid ${rgba(theme.foreground, 0.15)}`, fontSize: 26, color: theme.muted, lineHeight: 1.5 }}>
        {labels.narration ? <div>{labels.narration}</div> : null}
        {labels.music ? <div>{labels.music}</div> : null}
        <div style={{ color: theme.foreground, fontWeight: 700 }}>{labels.madeWith}</div>
      </div>
    </div>
  );
};
