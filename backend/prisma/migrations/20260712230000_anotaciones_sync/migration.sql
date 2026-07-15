-- F9 · Respaldo en nube de anotaciones locales (subrayados/notas, clave local dv_anotaciones_v1).
-- PK compuesta (userId, id): el id lo genera el cliente, así que se aísla por usuario.
-- "updatedAt" NO usa @updatedAt en Prisma: lo fija el servidor a partir del valor
-- enviado por el cliente para poder aplicar last-write-wins.
-- Migración escrita a mano; aplicar con `prisma migrate deploy` (no ejecutada aquí).

-- CreateTable
CREATE TABLE "Anotacion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "unitIndex" INTEGER NOT NULL,
    "unitLabel" TEXT,
    "excerpt" TEXT NOT NULL,
    "nota" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Anotacion_pkey" PRIMARY KEY ("userId","id")
);

-- CreateIndex
CREATE INDEX "Anotacion_userId_documentId_idx" ON "Anotacion"("userId", "documentId");

-- AddForeignKey
ALTER TABLE "Anotacion" ADD CONSTRAINT "Anotacion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
