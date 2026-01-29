import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TreeNode } from '@/api/documents';

interface FolderTreeProps {
  tree: TreeNode;
  currentPath: string;
  onSelect: (path: string, document?: TreeNode['document']) => void;
}

interface TreeItemProps {
  node: TreeNode;
  level: number;
  currentPath: string;
  onSelect: (path: string, document?: TreeNode['document']) => void;
}

function TreeItem({ node, level, currentPath, onSelect }: TreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const isSelected = currentPath === node.path;
  const isFolder = node.type === 'folder';
  const hasChildren = isFolder && node.children && node.children.length > 0;

  const handleClick = () => {
    if (isFolder) {
      setIsExpanded(!isExpanded);
    }
    onSelect(node.path, node.document);
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left',
          isSelected
            ? 'bg-blue-100 text-blue-900'
            : 'hover:bg-gray-100 text-gray-700',
          level > 0 && 'ml-4'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {isFolder ? (
          <>
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-500" />
              )
            ) : (
              <span className="w-4" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 flex-shrink-0 text-yellow-600" />
            ) : (
              <Folder className="h-4 w-4 flex-shrink-0 text-yellow-600" />
            )}
          </>
        ) : (
          <>
            <span className="w-4" />
            <FileText className="h-4 w-4 flex-shrink-0 text-blue-600" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {isFolder && isExpanded && hasChildren && (
        <div>
          {node.children!.map((child, index) => (
            <TreeItem
              key={`${child.path}-${index}`}
              node={child}
              level={level + 1}
              currentPath={currentPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({ tree, currentPath, onSelect }: FolderTreeProps) {
  return (
    <div className="py-2">
      <TreeItem
        node={tree}
        level={0}
        currentPath={currentPath}
        onSelect={onSelect}
      />
    </div>
  );
}
