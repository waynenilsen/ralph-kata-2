'use client';

import { useActionState } from 'react';
import { type CreateCommentState, createComment } from '@/app/actions/comments';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CommentItem } from './comment-item';

type Comment = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; email: string };
};

type CommentSectionProps = {
  todoId: string;
  comments: Comment[];
};

const initialState: CreateCommentState = {};

export function CommentSection({ todoId, comments }: CommentSectionProps) {
  const [state, formAction, isPending] = useActionState(
    createComment.bind(null, todoId),
    initialState,
  );

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <h4 className="text-sm font-medium">Comments ({comments.length})</h4>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet</p>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      <form action={formAction} className="space-y-2">
        <Textarea
          name="content"
          placeholder="Add a comment..."
          rows={2}
          required
        />
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Adding...' : 'Add Comment'}
        </Button>
      </form>
    </div>
  );
}
