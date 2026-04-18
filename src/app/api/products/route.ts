import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { productSchema } from "@/lib/validations/product";
import { ProductService } from "@/services/productService";

const formatProductError = (error: unknown) => {
  const message = (error as any)?.message || "Failed to save product";
  if (typeof message === "string" && message.includes("Unique constraint")) {
    return "Product code must be unique.";
  }
  return message;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const data = await ProductService.getProductManagerData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Product GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch product portfolio" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    const payload = productSchema.parse(body);
    const product = await ProductService.createProduct(payload);
    return NextResponse.json(product);
  } catch (error) {
    console.error("Product POST Error:", error);
    return NextResponse.json({ error: formatProductError(error) }, { status: 400 });
  }
}
