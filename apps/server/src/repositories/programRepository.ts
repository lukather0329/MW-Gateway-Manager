import { prisma } from '../config/prisma';

export const programRepository = {
  list() {
    return prisma.program.findMany({ orderBy: { createdAt: 'desc' } });
  },

  findById(id: string) {
    return prisma.program.findUnique({ where: { id } });
  },

  findByDomain(domain: string) {
    return prisma.program.findUnique({ where: { domain } });
  },

  /** Other programs already bound to the same host+port (used for a soft duplicate warning, not a hard block). */
  findByHostAndPort(targetHost: string, targetPort: number, excludeId?: string) {
    return prisma.program.findMany({
      where: {
        targetHost,
        targetPort,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  },

  findByPort(targetPort: number, excludeId?: string) {
    return prisma.program.findMany({
      where: {
        targetPort,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  },

  create(data: Parameters<typeof prisma.program.create>[0]['data']) {
    return prisma.program.create({ data });
  },

  update(id: string, data: Parameters<typeof prisma.program.update>[0]['data']) {
    return prisma.program.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.program.delete({ where: { id } });
  },
};
