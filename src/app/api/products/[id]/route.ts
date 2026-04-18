import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { productUpdateSchema } from "@/lib/validations/product";
import { ProductService } from "@/services/productService";

const formatProductError = (error: unknown) => {
  const message = (error as any)?.message || "Failed to update product";
  if (typeof message === "string" && message.includes("Unique constraint")) {
    return "Product code must be unique.";
  }
  return message;
};

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const body = await req.json();
    const payload = productUpdateSchema.parse(body);
    const product = await ProductService.updateProduct(params.id, payload);
    return NextResponse.json(product);
  } catch (error) {
    console.error("Product PATCH Error:", error);
    return NextResponse.json({ error: formatProductError(error) }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "OPERATOR") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    await ProductService.deleteProduct(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Product DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 400 });
  }
}
