import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, FileText, Loader2 } from 'lucide-react';
import { FolderTree } from './FolderTree';
import { Breadcrumb } from './Breadcrumb';
import type { TreeNode, Document } from '@/api/documents';
import { getDocumentsTree } from '@/api/documents';
import { formatDate, formatCurrency } from '@/lib/formatters';

function findNodeByPath(tree: TreeNode, path: string): TreeNode | null {
  if (tree.path === path) return tree;

  if (tree.children) {
    for (const child of tree.children) {
      const found = findNodeByPath(child, path);
      if (found) return found;
    }
  }

  return null;
}

export function FileExplorer() {
  const navigate = useNavigate();
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTree() {
      try {
        setIsLoading(true);
        const data = await getDocumentsTree();
        setTree(data);
      } catch (err) {
        setError('Errore nel caricamento dei documenti');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadTree();
  }, []);

  const handleSelect = (path: string, document?: Document) => {
    setCurrentPath(path);
    if (document) {
      navigate(`/documents/${document.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 py-8">
        {error}
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="text-center text-gray-500 py-8">
        Nessun documento trovato
      </div>
    );
  }

  const currentNode = findNodeByPath(tree, currentPath);

  return (
    <div className="flex h-[calc(100vh-200px)] border rounded-lg overflow-hidden bg-white">
      {/* Sidebar con albero */}
      <aside className="w-72 border-r bg-gray-50 overflow-y-auto">
        <div className="p-3 border-b bg-white">
          <h3 className="font-semibold text-sm text-gray-700">Esplora</h3>
        </div>
        <FolderTree tree={tree} currentPath={currentPath} onSelect={handleSelect} />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 overflow-y-auto">
        <Breadcrumb path={currentPath} onNavigate={setCurrentPath} />

        {currentNode?.type === 'folder' && currentNode.children ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currentNode.children.map((child, index) => (
              <button
                key={`${child.path}-${index}`}
                onClick={() => handleSelect(child.path, child.document)}
                className="flex flex-col items-center p-4 rounded-lg border hover:bg-gray-50 transition-colors text-center"
              >
                {child.type === 'folder' ? (
                  <Folder className="h-12 w-12 text-yellow-500 mb-2" />
                ) : (
                  <FileText className="h-12 w-12 text-blue-500 mb-2" />
                )}
                <span className="text-sm font-medium text-gray-700 truncate w-full">
                  {child.name}
                </span>
                {child.document && (
                  <span className="text-xs text-gray-500 mt-1">
                    {child.document.totalAmount
                      ? formatCurrency(parseFloat(child.document.totalAmount))
                      : ''}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : currentNode?.type === 'file' && currentNode.document ? (
          <div className="max-w-md">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold">{currentNode.document.fileName}</h3>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Fornitore:</span> {currentNode.document.supplierName}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Cliente:</span> {currentNode.document.customerName}
              </p>
              {currentNode.document.dueDate && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Scadenza:</span>{' '}
                  {formatDate(currentNode.document.dueDate)}
                </p>
              )}
              {currentNode.document.totalAmount && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Totale:</span>{' '}
                  {formatCurrency(parseFloat(currentNode.document.totalAmount))}
                </p>
              )}
              <button
                onClick={() => navigate(`/documents/${currentNode.document!.id}`)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                Apri documento
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            Seleziona una cartella o un documento
          </div>
        )}

        {currentNode?.type === 'folder' && (!currentNode.children || currentNode.children.length === 0) && (
          <div className="text-center text-gray-500 py-8">
            Cartella vuota
          </div>
        )}
      </main>
    </div>
  );
}
