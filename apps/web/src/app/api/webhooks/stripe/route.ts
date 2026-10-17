import { handleStripeWebhook } from "@/lib/billing";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleStripeWebhook(rawBody, request.headers.get("stripe-signature"));
  return Response.json({ message: result.message }, { status: result.status });
}
