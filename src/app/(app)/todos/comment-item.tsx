import { formatDistanceToNow } from 'date-fns';

type CommentItemProps = {
  comment: {
    id: string;
    content: string;
    createdAt: Date;
    author: { id: string; email: string };
  };
};

export function CommentItem({ comment }: CommentItemProps) {
  return (
    <div className="text-sm border-l-2 border-muted pl-3 py-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="font-medium">{comment.author.email}</span>
        <span>·</span>
        <span>
          {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
        </span>
      </div>
      <p className="mt-1 whitespace-pre-wrap">{comment.content}</p>
    </div>
  );
}
