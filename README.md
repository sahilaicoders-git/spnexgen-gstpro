# SPGST Electron GST Dashboard

This project includes:

- Modern SPGST opening animation (JSON-driven)
- Client Selection Modal (search, keyboard navigation, recent clients, row select)
- Electron IPC + Node.js filesystem client data engine
- Auto-generated test clients and monthly JSON files (Indian FY)
- React + Tailwind Add Client UI

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build renderer only (optional):

```bash
npm run build:renderer
```

3. Run Electron app (builds renderer first):

```bash
npm start
```

## Client Selection Modal

Renderer features:

- Opens from "Select Client"
- Search by client name or GSTIN
- Table with: Client Name, GSTIN, Client Type, Status, row Select action
- Keyboard support: Arrow Up/Down, Enter to select, Escape to close
- Recently Used Clients section
- Add New Client quick-create inside modal
- Saves selected and recent clients in localStorage
- Auto-load last selected client
- Redirects selection into dashboard context

Main process features:

- Creates `data/clients` on first run
- Auto-generates 10 test clients if none exist
- Creates FY folder and 12 month JSON files per client
- Prevents duplicate GSTIN folder creation
- Supports backup ZIP of client data folder

IPC channels exposed via preload:

- `get-clients`
- `create-client-structure`
- `load-month-data`
- `save-month-data`
- `backup-data-folder`

## Data Structure

```
data/
	clients/
		{client_name}_{gstin}/
			client.json
			FY_YYYY-YY/
				April.json
				May.json
				June.json
				July.json
				August.json
				September.json
				October.json
				November.json
				December.json
				January.json
				February.json
				March.json
```

## JSON Config

Edit `data/opening-animation.json`:

- `appName`: title shown during opening
- `kicker`: small heading text
- `tagline`: subtitle text
- `durationMs`: opening animation duration in milliseconds
- `primaryColor`: main gradient color
- `accentColor`: secondary gradient color
- `backgroundStart`: opening background start color
- `backgroundEnd`: opening background end color
- `autoOpenMain`: if `true`, opens the Add Client dashboard after animation

## Add Client Form Features

- Multi-step wizard layout with section icons
- GSTIN, PAN, email, mobile, and pincode validation
- PAN + state auto-derived from GSTIN
- GSTIN fetch simulation button for quick prefill
- Duplicate GSTIN prevention using local storage
- Responsive design for desktop and mobile

## Structure

- `src/main.js` - Electron process and window flow
- `src/preload.js` - Safe IPC bridge for renderer
- `src/services/clientDataService.js` - fs/path + JSON read/write + ZIP backup
- `src/scripts/initTestClients.js` - First-run test client generator
- `src/splash.html` - Opening screen
- `src/splash.js` - JSON loader and progress animation logic
- `src/styles/splash.css` - Animation and visual style
- `src/ui/AddClientForm.tsx` - Add Client wizard UI component
- `renderer/index.html` - Vite renderer entry
- `renderer/src/App.tsx` - Dashboard shell + selection flow
- `renderer/src/components/ClientSelectionModal.tsx` - Client Selection Modal UI
- `renderer/src/types.d.ts` - Renderer IPC types
- `renderer/src/main.tsx` - React mount point
- `renderer/src/index.css` - Tailwind stylesheet entry
- `data/opening-animation.json` - Animation configuration
