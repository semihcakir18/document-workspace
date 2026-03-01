/**
 * Group list component with drag-and-drop support
 * Allows organizing documents into groups for targeted search and chat
 */

import { useState, useEffect } from 'react';
import { Upload, Plus, ChevronRight, ChevronDown, Trash2, FileText, FolderOpen, GripVertical, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import {
  getAllGroups,
  getAllDocuments,
  saveGroup,
  deleteGroup,
  saveDocument,
  saveChunks,
  addDocumentToGroup,
  removeDocumentFromGroup,
  getDocumentsByGroup,
  deleteDocument as dbDeleteDocument
} from '../../services/db';
import { parsePDF } from '../../services/pdfParser';
import type { Group, Document } from '../../types/index';
import './GroupList.css';

const GROUP_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
];

export default function GroupList() {
  const { selectedGroup, setSelectedGroup, setSelectedDocument, setLoading, setError } = useStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [ungroupedDocs, setUngroupedDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [draggedDoc, setDraggedDoc] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    loadGroupsAndDocuments();
  }, []);

  const loadGroupsAndDocuments = async () => {
    const allGroups = await getAllGroups();
    const allDocs = await getAllDocuments();

    // Sync group documentIds with actual documents
    const updatedGroups: Group[] = [];
    for (const group of allGroups) {
      const groupDocs = allDocs.filter(doc => doc.groupId === group.id);

      // Sync documentIds
      const actualDocIds = groupDocs.map(d => d.id);
      if (JSON.stringify(group.documentIds.sort()) !== JSON.stringify(actualDocIds.sort())) {
        group.documentIds = actualDocIds;
        await saveGroup(group);
      }
      updatedGroups.push(group);
    }

    const ungrouped = allDocs.filter(doc => !doc.groupId);

    setGroups(updatedGroups);
    setUngroupedDocs(ungrouped);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    const group: Group = {
      id: crypto.randomUUID(),
      name: newGroupName.trim(),
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
      createdAt: new Date(),
      documentIds: [],
    };

    await saveGroup(group);
    await loadGroupsAndDocuments();
    setNewGroupName('');
    setShowNewGroup(false);
  };

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this group? Documents will be moved to ungrouped.')) {
      await deleteGroup(groupId);
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
      }
      await loadGroupsAndDocuments();
    }
  };

  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this document permanently?')) {
      await dbDeleteDocument(docId);
      await loadGroupsAndDocuments();
      setReloadTrigger(prev => prev + 1);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    if (!file.type.includes('pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setLoading(true);
    setError(null);

    try {
      console.log('Parsing PDF:', file.name);
      const { document, chunks } = await parsePDF(file);

      // Auto-create a group for this document
      const groupName = file.name.replace('.pdf', '');
      const newGroup: Group = {
        id: crypto.randomUUID(),
        name: groupName,
        color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
        createdAt: new Date(),
        documentIds: [document.id],
      };

      // Save group and document with groupId
      await saveGroup(newGroup);
      document.groupId = newGroup.id;
      await saveDocument(document);
      await saveChunks(chunks);

      await loadGroupsAndDocuments();

      // Auto-select the new group
      setSelectedGroup(newGroup);
      setExpandedGroups(prev => new Set(prev).add(newGroup.id));

      console.log('Document uploaded and group created successfully');
    } catch (err) {
      console.error('Failed to upload document:', err);
      setError('Failed to parse PDF. Please try another file.');
    } finally {
      setUploading(false);
      setLoading(false);
    }
  };

  const handleDragStart = (docId: string) => {
    setDraggedDoc(docId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnGroup = async (groupId: string) => {
    if (!draggedDoc) return;

    console.log(`Moving document ${draggedDoc} to group ${groupId}`);
    await addDocumentToGroup(draggedDoc, groupId);
    setDraggedDoc(null);

    // Force reload to update counts and trigger document reload in groups
    await loadGroupsAndDocuments();
    setReloadTrigger(prev => prev + 1);
  };

  const handleDropOnUngrouped = async () => {
    if (!draggedDoc) return;

    console.log(`Removing document ${draggedDoc} from group`);
    await removeDocumentFromGroup(draggedDoc);
    setDraggedDoc(null);

    // Force reload to update counts and trigger document reload in groups
    await loadGroupsAndDocuments();
    setReloadTrigger(prev => prev + 1);
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleSelectGroup = (group: Group) => {
    setSelectedGroup(group);
    setSelectedDocument(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="group-list">
      <div className="group-list-header">
        <h2>Document Groups</h2>
        <label className={`upload-button ${uploading ? 'uploading' : ''}`}>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          {uploading ? (
            <>
              <Loader2 className="icon spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="icon" />
              <span>Upload PDF</span>
            </>
          )}
        </label>
      </div>

      <div className="groups-container">
        {/* Create new group */}
        {showNewGroup ? (
          <div className="new-group-form">
            <input
              type="text"
              placeholder="Group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateGroup()}
              autoFocus
            />
            <button onClick={handleCreateGroup}>Create</button>
            <button onClick={() => setShowNewGroup(false)}>Cancel</button>
          </div>
        ) : (
          <button className="create-group-button" onClick={() => setShowNewGroup(true)}>
            <Plus className="icon" />
            <span>New Group</span>
          </button>
        )}

        {/* Groups */}
        {groups.map(group => {
          const isExpanded = expandedGroups.has(group.id);
          const docs = ungroupedDocs.concat([]); // Will load actual docs per group

          return (
            <div
              key={group.id}
              className={`group-item ${selectedGroup?.id === group.id ? 'selected' : ''}`}
              onDragOver={handleDragOver}
              onDrop={() => handleDropOnGroup(group.id)}
            >
              <div className="group-header" onClick={() => handleSelectGroup(group)}>
                <button
                  className="expand-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(group.id);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="icon" />
                  ) : (
                    <ChevronRight className="icon" />
                  )}
                </button>
                <div className="group-color" style={{ background: group.color }} />
                <span className="group-name">{group.name}</span>
                <span className="group-count">{group.documentIds.length}</span>
                <button
                  className="delete-button"
                  onClick={(e) => handleDeleteGroup(group.id, e)}
                  title="Delete group"
                >
                  <Trash2 className="icon" />
                </button>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <GroupDocuments
                      groupId={group.id}
                      reloadTrigger={reloadTrigger}
                      onDragStart={handleDragStart}
                      onDelete={handleDeleteDocument}
                      onSelect={setSelectedDocument}
                      formatFileSize={formatFileSize}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Ungrouped documents */}
        {ungroupedDocs.length > 0 && (
          <div
            className="ungrouped-section"
            onDragOver={handleDragOver}
            onDrop={handleDropOnUngrouped}
          >
            <div className="ungrouped-header">
              <FolderOpen className="icon" />
              <span>Ungrouped</span>
              <span className="ungrouped-count">{ungroupedDocs.length}</span>
            </div>
            <div className="document-items">
              {ungroupedDocs.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="document-item"
                  draggable
                  onDragStart={() => handleDragStart(doc.id)}
                  onClick={() => setSelectedDocument(doc)}
                >
                  <GripVertical className="drag-icon" />
                  <FileText className="document-icon" />
                  <div className="document-info">
                    <div className="document-name">{doc.name}</div>
                    <div className="document-meta">
                      {formatFileSize(doc.size)}
                      {doc.pageCount && ` • ${doc.pageCount} pages`}
                    </div>
                  </div>
                  <button
                    className="delete-button"
                    onClick={(e) => handleDeleteDocument(doc.id, e)}
                    title="Delete document"
                  >
                    <Trash2 className="icon" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component to load and display documents in a group
function GroupDocuments({
  groupId,
  reloadTrigger,
  onDragStart,
  onDelete,
  onSelect,
  formatFileSize,
}: {
  groupId: string;
  reloadTrigger: number;
  onDragStart: (docId: string) => void;
  onDelete: (docId: string, e: React.MouseEvent) => void;
  onSelect: (doc: Document) => void;
  formatFileSize: (bytes: number) => string;
}) {
  const [docs, setDocs] = useState<Document[]>([]);

  useEffect(() => {
    loadDocs();
  }, [groupId, reloadTrigger]);

  const loadDocs = async () => {
    const groupDocs = await getDocumentsByGroup(groupId);
    setDocs(groupDocs);
  };

  if (docs.length === 0) {
    return (
      <div className="group-empty">
        Drag documents here
      </div>
    );
  }

  return (
    <div className="group-documents">
      {docs.map((doc, index) => (
        <motion.div
          key={doc.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: index * 0.05 }}
          className="document-item"
          draggable
          onDragStart={() => onDragStart(doc.id)}
          onClick={() => onSelect(doc)}
        >
          <GripVertical className="drag-icon" />
          <FileText className="document-icon" />
          <div className="document-info">
            <div className="document-name">{doc.name}</div>
            <div className="document-meta">
              {formatFileSize(doc.size)}
              {doc.pageCount && ` • ${doc.pageCount} pages`}
            </div>
          </div>
          <button
            className="delete-button"
            onClick={(e) => onDelete(doc.id, e)}
            title="Delete document"
          >
            <Trash2 className="icon" />
          </button>
        </motion.div>
      ))}
    </div>
  );
}
