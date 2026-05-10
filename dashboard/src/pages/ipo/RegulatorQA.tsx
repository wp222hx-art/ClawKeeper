// file: dashboard/src/pages/ipo/RegulatorQA.tsx
// description: Regulator Q&A workspace — surfaces incoming SEC comment letters
//              or HKEX hearing comments, drafts cited responses. Phase 1 shows
//              the queue UI and lets users manually paste questions; the AI
//              drafting hook activates once a provider is configured.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, MessageSquare } from 'lucide-react';

interface QaDraft {
  id: string;
  source: 'SEC_COMMENT_LETTER' | 'HKEX_HEARING' | 'INTERNAL';
  question: string;
  status: 'DRAFTING' | 'AWAITING_LAWYER' | 'APPROVED';
}

export function IpoRegulatorQa() {
  const { id } = useParams<{ id: string }>();
  const [question, set_question] = useState('');
  const [drafts, set_drafts] = useState<QaDraft[]>([]);

  const submit = () => {
    if (!question.trim()) return;
    set_drafts(d => [
      { id: crypto.randomUUID(), source: 'INTERNAL', question, status: 'DRAFTING' },
      ...d,
    ]);
    set_question('');
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Link to={`/ipo/projects/${id}`}>
        <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8 text-primary" /> Regulator Q&A
        </h1>
        <p className="text-muted-foreground mt-1">
          Drafts cited responses to SEC comment letters / HKEX hearing comments.
          Every draft must be reviewed by a licensed lawyer before submission.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New Question</CardTitle>
          <CardDescription>Paste a regulator comment or internal question to seed a draft response.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={4}
            placeholder="Paste the SEC comment / HKEX question here…"
            value={question}
            onChange={(e) => set_question(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={!question.trim()}>Queue Draft</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Queue ({drafts.length})</CardTitle></CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No questions yet. AI-drafted responses will appear here once a provider is configured.
            </p>
          ) : (
            <ul className="space-y-3">
              {drafts.map(d => (
                <li key={d.id} className="p-3 rounded border">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{d.source}</Badge>
                    <Badge>{d.status}</Badge>
                  </div>
                  <p className="text-sm">{d.question}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Awaiting AI drafter — Phase 2.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
