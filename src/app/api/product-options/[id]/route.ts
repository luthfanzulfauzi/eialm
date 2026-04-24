import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { productOptionUpdateSchema } from "@/lib/validations/product";
import { ProductService } from "@/services/productService";

const formatProductOptionError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "That dropdown value already exists for this list.";
    }
    if (error.code === "P2003") {
      return "This dropdown value is still used by one or more products.";
    }
  }

  return (error as any)?.message || "Failed to update dropdown option";
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden: Admin access required", { status: 403 });
  }

  try {
    const body = await req.json();
    const payload = productOptionUpdateSchema.parse(body);
    const option = await ProductService.updateProductOption(id, payload);
    return NextResponse.json(option);
  } catch (error) {
    console.error("Product Option PATCH Error:", error);
    return NextResponse.json({ error: formatProductOptionError(error) }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden: Admin access required", { status: 403 });
  }

  try {
    await ProductService.deleteProductOption(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Product Option DELETE Error:", error);
    return NextResponse.json({ error: formatProductOptionError(error) }, { status: 400 });
  }
}
