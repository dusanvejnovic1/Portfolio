export const runtime = 'nodejs'

export async function GET() {
  return Response.json({
    bing: !!process.env.BING_SEARCH_API_KEY,
    youtube: !!process.env.YOUTUBE_API_KEY,
  })
}