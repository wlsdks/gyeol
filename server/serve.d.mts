import type { Server } from 'node:http'

export const HOST: string
export const PORT: number
export const CSP: string
export function createAppServer(root?: string): Server
