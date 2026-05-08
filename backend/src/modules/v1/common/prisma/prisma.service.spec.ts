import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('extends PrismaClient and exposes lifecycle hooks', () => {
    const svc = new PrismaService();
    expect(typeof svc.$connect).toBe('function');
    expect(typeof svc.$disconnect).toBe('function');
    expect(typeof svc.onModuleInit).toBe('function');
    expect(typeof svc.onModuleDestroy).toBe('function');
  });

  it('onModuleInit calls $connect', async () => {
    const svc = new PrismaService();
    const spy = jest.spyOn(svc, '$connect').mockResolvedValue(undefined as never);
    await svc.onModuleInit();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy calls $disconnect', async () => {
    const svc = new PrismaService();
    const spy = jest.spyOn(svc, '$disconnect').mockResolvedValue(undefined as never);
    await svc.onModuleDestroy();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
