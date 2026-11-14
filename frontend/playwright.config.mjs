import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
const access=JSON.parse(readFileSync(new URL('../.demo/access.json',import.meta.url),'utf8'));
export default defineConfig({
  testDir:'tests/browser',workers:1,fullyParallel:false,timeout:120000,
  expect:{timeout:15000},reporter:'list',
  use:{baseURL:access.local_url,httpCredentials:{username:access.username,password:access.password},
    browserName:'chromium',channel:'msedge',viewport:{width:1440,height:1000},trace:'off'},
});
