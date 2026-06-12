// Samsung TV Seller Office sertifikasyonu için App Description File (.docx) üretir.
// Kullanım: node scripts/make-app-description.mjs
import fs from 'fs';
import path from 'path';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
         AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak } from 'docx';

const ASSETS = 'C:\\Tizen iptv Project\\smart-xtream-tizen\\store-assets';
const OUT = path.join(ASSETS, 'App_Description_Smart_Xtream_AI_IPTV_Player.docx');

const img = (file, w, h, title) => new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(path.join(ASSETS, file)), transformation: { width: w, height: h }, altText: { title, description: title, name: title } })],
});
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const p = (t, opts = {}) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, ...opts })] });
const bullet = (t) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, children: [new TextRun(t)] });
const num = (t) => new Paragraph({ numbering: { reference: 'steps', level: 0 }, children: [new TextRun(t)] });
const caption = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: t, italics: true, size: 20, color: '555555' })] });

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };
const cell = (t, w, head = false) => new TableCell({
  borders, width: { size: w, type: WidthType.DXA },
  shading: head ? { fill: 'D5E8F0', type: ShadingType.CLEAR } : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  children: [new Paragraph({ children: [new TextRun({ text: t, bold: head })] })],
});
const row2 = (a, b, head = false) => new TableRow({ children: [cell(a, 3120, head), cell(b, 6240, head)] });
const infoTable = new Table({
  width: { size: 9360, type: WidthType.DXA }, columnWidths: [3120, 6240],
  rows: [
    row2('Item', 'Value', true),
    row2('Application Title', 'Smart Xtream AI IPTV Player'),
    row2('Version', '1.0.1'),
    row2('Type', 'Tizen Web Application (.wgt)'),
    row2('Tizen Application ID', 'SmrtXtrm01.SmartXtream'),
    row2('Minimum Platform', 'Tizen 4.0 (2018+ Samsung Smart TVs)'),
    row2('Billing', 'Free — no payment function'),
    row2('Seller', 'ByBora (Bora Savkar)'),
    row2('Support E-mail', 'borasavkar@gmail.com'),
  ],
});
const keyTable = new Table({
  width: { size: 9360, type: WidthType.DXA }, columnWidths: [3120, 6240],
  rows: [
    row2('Remote Key', 'Function', true),
    row2('Arrow keys', 'Navigate between items / move focus'),
    row2('OK (Enter)', 'Select / activate focused item'),
    row2('Return (Back)', 'Go back / close popup / exit text field'),
    row2('Left / Right (during VOD playback)', 'Accelerated seeking — hold to seek faster (10s → 30s → 60s → 120s steps); the seek is applied once on release'),
    row2('Up / Down (during live TV)', 'Channel zapping'),
    row2('Play / Pause / Rewind / FF media keys', 'Standard transport controls'),
  ],
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial' }, paragraph: { spacing: { before: 280, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial' }, paragraph: { spacing: { before: 200, after: 140 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: 'Smart Xtream AI IPTV Player', bold: true, size: 44 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320 }, children: [new TextRun({ text: 'App Description File — Samsung TV Seller Office Certification', size: 24, color: '444444' })] }),
      infoTable,

      h1('1. Application Overview'),
      p('Smart Xtream AI IPTV Player is an IPTV player client for Samsung Smart TVs. Users sign in with the credentials of their own IPTV subscription (Xtream Codes API) and watch their provider’s live TV channels, movies and series.'),
      p('IMPORTANT: The application does NOT provide, host, sell or promote any content. It is a player only — all content comes from the user’s own IPTV provider. Without a subscription, the built-in Demo Mode (sample/open content) demonstrates every feature.', { bold: true }),

      h1('2. How to Test — No Account Required (Demo Mode)'),
      num('Launch the application.'),
      num('The profile screen appears on first launch. Press the “Load Demo Data (For Reviewers)” button.'),
      num('A demo profile is created automatically. The home dashboard loads with sample categories, movies and series that use publicly available sample streams.'),
      num('Every feature can now be tested: browsing, search, Quick Preview popup, full-screen player with accelerated seeking, favorites, watch history, settings and language selection.'),
      p(''),
      p('To test with a real IPTV account instead: choose “Add Profile” and enter any valid Xtream Codes server URL, username and password.'),

      h1('3. Screen Guide'),
      h2('3.1 Home Dashboard'),
      img('screenshot-1-home.jpg', 600, 338, 'Home dashboard'),
      caption('Left sidebar: profile, Live TV / Movies / Series navigation, favorites and settings. Content area: Continue Watching, recommendations and latest additions rails.'),
      h2('3.2 Quick Preview Popup'),
      img('screenshot-2-quick-preview.jpg', 600, 338, 'Quick preview popup'),
      caption('Resting on a poster for ~2 seconds opens a centered popup with an inline muted video preview, metadata chips (year, duration, rating, genre), plot, cast and “Play Now” / “Full Details” actions. Return closes it.'),
      h2('3.3 Player'),
      img('screenshot-3-player.jpg', 600, 338, 'Player'),
      caption('Bottom control bar with focusable progress bar and transport buttons; top HUD shows resolution, bandwidth and clock. Settings menu offers audio track, subtitle, subtitle style and video quality selection.'),
      h2('3.4 Movies Screen'),
      img('screenshot-4-movies.jpg', 600, 338, 'Movies screen'),
      caption('Category list with search; poster grid of the selected category. Series screen follows the same layout with season/episode lists in detail pages.'),

      new Paragraph({ children: [new PageBreak()] }),
      h1('4. Remote Control Mapping'),
      keyTable,

      h1('5. Feature Summary'),
      bullet('Multi-profile Xtream Codes login with TV-keyboard-friendly forms (SmartThings mobile keyboard supported)'),
      bullet('Live TV with instant channel zapping, EPG line and favorites'),
      bullet('Movies & series: categories, search, detail pages, episode lists, resume from watch history'),
      bullet('Quick Preview popup with inline video preview and metadata'),
      bullet('Player: AVPlay engine, accelerated hold-seeking, audio/subtitle/quality menus, styled subtitles'),
      bullet('11 interface languages (TR, EN, DE, FR, ES, IT, PT, NL, PL, RU, AR)'),

      h1('6. Notes for Certification'),
      bullet('Billing: Free. There is no payment function, no in-app purchase and no advertisement in this version.'),
      bullet('No personal information is collected or transmitted to the seller. IPTV credentials are stored only on the device and are sent only to the user’s own IPTV server.'),
      bullet('No DRM is used. Streams play over HTTP/HTTPS (progressive and HLS) through the AVPlay engine.'),
      bullet('Demo Mode uses publicly available sample streams (e.g. open demo MP4s) for testing purposes only.'),
      bullet('Privileges used: internet, application.launch, tv.inputdevice (media key registration).'),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log('written:', OUT, Math.round(buf.length / 1024) + ' KB'); });
