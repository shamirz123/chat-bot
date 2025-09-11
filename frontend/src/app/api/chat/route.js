export async function POST(req) {
  const { query } = await req.json();
  const res = await fetch(`${process.env.BACKEND_URL}/api/chat`, {  // Or use env
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  return Response.json(data);
}