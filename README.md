# ZeroshotBio Landing Page

This repository contains the marketing and demonstration website for **Zeroshot Bio**. The project is built with Next.js and TypeScript and showcases two major features:

- **Investor Data Room** – a collection of pages outlining the company vision, technology and market opportunity.
- **Gene Explorer** – an interactive network visualization powered by a back‑end model.

The site uses Tailwind CSS for styling and is configured to deploy to Vercel.

## Getting Started

Install dependencies and start the development server:

```bash
npm install    # only required on first run
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000) to view the site.

### Project Structure

```
src/app
├─ page.tsx               – landing page
├─ layout.tsx             – global layout and fonts
├─ globals.css            – Tailwind configuration
├─ DarkModeButton.tsx     – helper component
├─ api/
│   └─ visitors/route.ts  – DynamoDB logging endpoint
├─ dataroom/
│   ├─ page.tsx           – investor portal wrapper
│   ├─ components/
│   │   └─ ClientOnlyD3Treemap.tsx
│   └─ docs/
│       ├─ A_Overview/
│       │   ├─ A_Introduction.tsx
│       │   └─ B_Overall_Summary.tsx
│       ├─ B_Problem/
│       │   ├─ A_BiologyIsComplex.tsx
│       │   ├─ B_DrugDevelopment.tsx
│       │   └─ C_CaseStudyLeukemia.tsx
│       ├─ C_Vision/
│       │   ├─ A_VisionOverview.tsx
│       │   ├─ B_FirstPrinciples.tsx
│       │   ├─ C_Zebrafish.tsx
│       │   ├─ D_scRNA.tsx
│       │   └─ E_FuturePotential.tsx
│       ├─ D_Technology/
│       │   ├─ A_BioFoundationModels.tsx
│       │   ├─ B_DataSources.tsx
│       │   └─ C_BiologistPerspective.tsx
│       ├─ E_Business_Model/
│       │   └─ A_BusinessModel.tsx
│       ├─ F_Market_Opportunity/
│       │   ├─ A_MarketOpportunity.tsx
│       │   └─ B_Customers.tsx
│       ├─ G_Competitive_Landscape/
│       │   └─ A_CompetitiveLandscape.tsx
│       └─ H_Team_and_Advisors/
│           └─ A_TeamAdvisors.tsx
├─ gene-explorer/
│   └─ page.tsx           – interactive network demo
└─ favicon.ico
```

Static assets such as images and CSV files live in the `public/` directory. A list of gene names used by the Gene Explorer is served from `public/gene_names.json`.

## Architecture Overview

The application uses the [App Router](https://nextjs.org/docs/app/building-your-application/routing) introduced in Next.js 13. Each folder under `src/app` becomes a route. Server and client components are mixed as needed. The Data Room pages are client components so they can leverage dynamic D3 visualizations, while layout and API routes run on the server.

### API

The `api/visitors/route.ts` endpoint logs page visits to AWS DynamoDB using the AWS SDK. It exposes simple `POST` and `PUT` handlers that store the visitor start and end times.

### Gene Explorer

The Gene Explorer page loads a vis-network canvas in the browser and issues inference requests to a separate Flask service. A detailed explanation of its internals can be found in [README_gene_explorer.md](README_gene_explorer.md).

## Deployment

The project is ready to deploy to Vercel. Running `npm run build` will create an optimized production build (requires all dependencies to be installed). Environment variables such as `NEXT_PUBLIC_FLASK_ENDPOINT` and AWS credentials for DynamoDB should be provided at deploy time.

