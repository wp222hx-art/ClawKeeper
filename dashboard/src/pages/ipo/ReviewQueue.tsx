// file: dashboard/src/pages/ipo/ReviewQueue.tsx
// description: Review Queue — pending signoffs across the project, where
//              licensed humans (lawyer / auditor / CFO / sponsor) approve or
//              reject AI-drafted artifacts before they can be marked final.

import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { ArrowLeft, ShieldCheck, ThumbsUp, ThumbsDown } from 'lucide-react';
import { ipo_api } from '@/lib/ipo-api';

export function IpoReviewQueue() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [notes, set_notes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['ipo-signoffs', id],
    queryFn: () => ipo_api.list_signoffs(id, 'PENDING'),
    enabled: !!id,
  });

  const decide = useMutation({
    mutationFn: ({ signoff_id, status, n }: { signoff_id: string; status: 'APPROVED' | 'REJECTED'; n?: string }) =>
      ipo_api.decide_signoff(signoff_id, status, n),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ipo-signoffs', id] }),
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-primary" /> Review Queue
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-drafted artifacts awaiting human sign-off. The database
          <code className="mx-1 px-1 bg-muted rounded text-xs">enforce_signoff_gate</code>
          trigger blocks any document from being marked final without all required role approvals.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-sm">
          <strong>AI Co-Pilot mode:</strong> AI drafts are <em>recommendations</em>.
          Your professional sign-off is the regulatory record of authorship.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Signoffs ({data?.count ?? 0})</CardTitle>
          <CardDescription>
            Approve to allow document finalization. Reject to send the artifact back to the
            originating workstream with your notes attached.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {data && data.signoffs.length === 0 && (
            <p className="text-sm text-muted-foreground">No pending signoffs. New requests will appear here.</p>
          )}
          {data && data.signoffs.length > 0 && (
            <ul className="space-y-3">
              {data.signoffs.map((s) => {
                const so = s as Record<string, string>;
                return (
                  <li key={so.id} className="p-4 rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge>{so.reviewer_role}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Document <code className="bg-muted px-1 rounded">{(so.document_id ?? '').slice(0, 8)}</code>
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {so.requested_at ? new Date(so.requested_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <Textarea
                      rows={2}
                      placeholder="Notes (optional)…"
                      value={notes[so.id] ?? ''}
                      onChange={(e) => set_notes(n => ({ ...n, [so.id]: e.target.value }))}
                      className="mb-2"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => decide.mutate({ signoff_id: so.id, status: 'REJECTED', n: notes[so.id] })}
                        disabled={decide.isPending}
                      >
                        <ThumbsDown className="h-4 w-4" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => decide.mutate({ signoff_id: so.id, status: 'APPROVED', n: notes[so.id] })}
                        disabled={decide.isPending}
                      >
                        <ThumbsUp className="h-4 w-4" /> Approve
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
