import { Container, Graphics, Text } from 'pixi.js';
import type { EphemeralStore } from '../scene/EphemeralStore';

export class PresenceRenderer {
  public container: Container;
  
  private cursorGraphics = new Map<string, { root: Container; g: Graphics; text: Text }>();
  private pingGraphics = new Map<string, Graphics>();
  private rulerGraphics = new Map<string, Graphics>();

  constructor(private store: EphemeralStore) {
    this.container = new Container();
    this.container.name = 'PresenceLayer';
    
    // Z-index presence above other map layers
    this.container.zIndex = 1000;
  }

  update() {
    this.store.cleanup();
    
    // Update cursors
    for (const [id, cursor] of this.store.cursors.entries()) {
      let cg = this.cursorGraphics.get(id);
      if (!cg) {
        const root = new Container();
        const g = new Graphics();
        const text = new Text(cursor.name, {
          fontFamily: 'sans-serif',
          fontSize: 12,
          fill: 0xffffff,
        });
        text.x = 12;
        text.y = 12;
        
        root.addChild(g);
        root.addChild(text);
        this.container.addChild(root);
        
        cg = { root, g, text };
        this.cursorGraphics.set(id, cg);
      }
      
      cg.root.x = cursor.x;
      cg.root.y = cursor.y;
      cg.text.text = cursor.name;
      
      const numColor = parseInt(cursor.color.replace('#', ''), 16) || 0xffffff;
      
      cg.g.clear();
      // Draw a simple cursor arrow pointing up-left
      cg.g.beginFill(numColor);
      cg.g.lineStyle(1, 0xffffff, 1);
      cg.g.moveTo(0, 0);
      cg.g.lineTo(15, 5);
      cg.g.lineTo(5, 15);
      cg.g.closePath();
      cg.g.endFill();
    }
    
    // Cleanup old cursors graphics
    for (const id of this.cursorGraphics.keys()) {
      if (!this.store.cursors.has(id)) {
        const cg = this.cursorGraphics.get(id)!;
        this.container.removeChild(cg.root);
        cg.root.destroy({ children: true });
        this.cursorGraphics.delete(id);
      }
    }
    
    // Update pings
    const now = Date.now();
    
    // Simpler Ping rendering: just redraw all pings from scratch
    for (const pg of this.pingGraphics.values()) {
      this.container.removeChild(pg);
      pg.destroy();
    }
    this.pingGraphics.clear();
    
    for (let i = 0; i < this.store.pings.length; i++) {
      const ping = this.store.pings[i];
      const age = now - ping.timestamp;
      if (age > 2000) continue;
      
      // Expand and fade
      const progress = age / 2000;
      const radius = 10 + (progress * 40);
      const alpha = 1 - progress;
      
      const g = new Graphics();
      const numColor = parseInt(ping.color.replace('#', ''), 16) || 0xff0000;
      g.lineStyle(3, numColor, alpha);
      g.drawCircle(ping.x, ping.y, radius);
      g.beginFill(numColor, alpha * 0.3);
      g.drawCircle(ping.x, ping.y, radius * 0.5);
      g.endFill();
      
      this.container.addChild(g);
      this.pingGraphics.set(`ping_${i}`, g);
    }
    
    // Rulers
    for (const [id, ruler] of this.store.rulers.entries()) {
      let rg = this.rulerGraphics.get(id);
      if (!rg) {
        rg = new Graphics();
        this.container.addChild(rg);
        this.rulerGraphics.set(id, rg);
      }
      
      const numColor = parseInt(ruler.color.replace('#', ''), 16) || 0xffffff;
      
      rg.clear();
      rg.lineStyle(3, numColor, 0.7);
      rg.moveTo(ruler.startX, ruler.startY);
      rg.lineTo(ruler.endX, ruler.endY);
      
      // For text, we'd need a Text object. For prototype, just drawing the line is great.
    }
    
    // Cleanup rulers
    for (const id of this.rulerGraphics.keys()) {
      if (!this.store.rulers.has(id)) {
        const rg = this.rulerGraphics.get(id)!;
        this.container.removeChild(rg);
        rg.destroy();
        this.rulerGraphics.delete(id);
      }
    }
  }
}
