import { prisma } from '../config/prisma';

export const deviceRepository = {
  list() {
    return prisma.device.findMany({ orderBy: { createdAt: 'desc' } });
  },
  findById(id: string) {
    return prisma.device.findUnique({ where: { id }, include: { tokens: true } });
  },
  create(data: Parameters<typeof prisma.device.create>[0]['data']) {
    return prisma.device.create({ data });
  },
  update(id: string, data: Parameters<typeof prisma.device.update>[0]['data']) {
    return prisma.device.update({ where: { id }, data });
  },
  delete(id: string) {
    return prisma.device.delete({ where: { id } });
  },
};
