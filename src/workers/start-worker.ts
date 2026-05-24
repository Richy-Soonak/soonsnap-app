#!/usr/bin/env node
/**
 * SoonSnap Render Worker — entry point
 * 
 * This file MUST use require() for dotenv because tsx/esbuild hoists
 * all ES import statements before any code runs. require() is synchronous
 * and executes in order, so env vars are available before job-queue.ts
 * module-level code runs.
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

// Verify env before importing anything else
if (!(process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error('FATAL: SUPABASE_URL_INTERNAL or NEXT_PUBLIC_SUPABASE_URL must be set')
  process.exit(1)
}
if (!process.env.SUPABASE_SERVICE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_KEY not set')
  process.exit(1)
}

console.log('✅ ENV loaded. Starting worker...')

// Now import the actual worker (env vars are set)
require('./render-worker-impl')
