import { NextRequest, NextResponse } from 'next/server';
import { AdminRole, ExperimentStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/auth/admin-auth';
import { resolveTenantContext } from '@/lib/tenant-context';
import { calculateCtr, pickWinner } from '@/lib/experiments/serp';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function formatExperiment(experiment: {
  id: string;
  postId: string;
  status: ExperimentStatus;
  variantATitle: string;
  variantAMetaDescription: string;
  variantBTitle: string;
  variantBMetaDescription: string;
  impressionsA: number;
  clicksA: number;
  impressionsB: number;
  clicksB: number;
  winner: 'A' | 'B' | null;
  startedAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    ...experiment,
    ctrA: calculateCtr(experiment.clicksA, experiment.impressionsA),
    ctrB: calculateCtr(experiment.clicksB, experiment.impressionsB),
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminAuth(request, AdminRole.EDITOR);
    if (!authResult.ok) return authResult.response;

    const { tenantId, websiteId } = await resolveTenantContext(request, authResult.auth);
    const { id } = await context.params;
    const body = await request.json();
    const action = String(body.action || '').trim();

    const experiment = await prisma.serpExperiment.findUnique({
      where: { id },
      include: {
        post: {
          select: { id: true, tenantId: true, websiteId: true },
        },
      },
    });

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    if (tenantId && experiment.tenantId && experiment.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Experiment does not belong to tenant' }, { status: 403 });
    }
    if (websiteId && experiment.websiteId && experiment.websiteId !== websiteId) {
      return NextResponse.json({ error: 'Experiment does not belong to website' }, { status: 403 });
    }

    if (action === 'record') {
      if (experiment.status !== ExperimentStatus.RUNNING) {
        return NextResponse.json({ error: 'Only running experiments can be updated.' }, { status: 400 });
      }

      const impressionsA = Number(body.impressionsA);
      const clicksA = Number(body.clicksA);
      const impressionsB = Number(body.impressionsB);
      const clicksB = Number(body.clicksB);

      const updated = await prisma.serpExperiment.update({
        where: { id: experiment.id },
        data: {
          ...(Number.isFinite(impressionsA) && impressionsA >= 0 ? { impressionsA } : {}),
          ...(Number.isFinite(clicksA) && clicksA >= 0 ? { clicksA } : {}),
          ...(Number.isFinite(impressionsB) && impressionsB >= 0 ? { impressionsB } : {}),
          ...(Number.isFinite(clicksB) && clicksB >= 0 ? { clicksB } : {}),
        },
      });

      return NextResponse.json({ success: true, experiment: formatExperiment(updated) });
    }

    if (action === 'select-winner') {
      if (experiment.status !== ExperimentStatus.RUNNING) {
        return NextResponse.json({ error: 'Experiment is not running.' }, { status: 400 });
      }

      const minImpressionsEach = Math.max(10, Number(body.minImpressionsEach || 50));
      let winner: 'A' | 'B';
      let ctrA = 0;
      let ctrB = 0;

      try {
        const picked = pickWinner({
          impressionsA: experiment.impressionsA,
          clicksA: experiment.clicksA,
          impressionsB: experiment.impressionsB,
          clicksB: experiment.clicksB,
          minImpressionsEach,
        });
        winner = picked.winner;
        ctrA = picked.ctrA;
        ctrB = picked.ctrB;
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to pick winner' },
          { status: 400 }
        );
      }

      const applyWinner = body.applyWinner !== false;
      const updates: Parameters<typeof prisma.serpExperiment.update>[0]['data'] = {
        status: ExperimentStatus.COMPLETED,
        winner,
        completedAt: new Date(),
      };

      const updatedExperiment = await prisma.serpExperiment.update({
        where: { id: experiment.id },
        data: updates,
      });

      if (applyWinner) {
        await prisma.post.update({
          where: { id: experiment.post.id },
          data:
            winner === 'B'
              ? {
                  title: experiment.variantBTitle,
                  metaDescription: experiment.variantBMetaDescription,
                  updatedAt: new Date(),
                }
              : {
                  title: experiment.variantATitle,
                  metaDescription: experiment.variantAMetaDescription,
                  updatedAt: new Date(),
                },
        });
      }

      return NextResponse.json({
        success: true,
        winner,
        ctrA,
        ctrB,
        experiment: formatExperiment(updatedExperiment),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[SERP Experiment] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update SERP experiment' },
      { status: 500 }
    );
  }
}
