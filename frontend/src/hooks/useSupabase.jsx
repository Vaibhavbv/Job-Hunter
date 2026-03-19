import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://qlvnnrmilwfxzlotduld.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsdm5ucm1pbHdmeHpsb3RkdWxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMzYwMTcsImV4cCI6MjA4ODkxMjAxN30.sDfvpxlCgPjGAHBlQpolVEB-wxQ8lbpMPdNsYqugumQ"

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export function useSupabase() {
  return supabase
}
