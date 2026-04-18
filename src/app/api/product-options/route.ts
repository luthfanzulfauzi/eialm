import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { productOptionSchema } from "@/lib/validations/product";
import { ProductService } from "@/services/productService";

const formatProductOptionError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "That dropdown value already exists for this list.";
    }
  }

  return (error as any)?.message || "Failed to save dropdown option";
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const data = await ProductService.getProductOptions();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Product Option GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch dropdown options" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden: Admin access required", { status: 403 });
  }

  try {
    const body = await req.json();
    const payload = productOptionSchema.parse(body);
    const option = await ProductService.createProductOption(payload);
    return NextResponse.json(option);
  } catch (error) {
    console.error("Product Option POST Error:", error);
    return NextResponse.json({ error: formatProductOptionError(error) }, { status: 400 });
  }
}
