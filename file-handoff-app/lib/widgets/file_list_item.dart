import 'package:flutter/material.dart';

import '../models/tracked_file.dart';

class FileListItem extends StatelessWidget {
  final TrackedFile file;
  final String Function(String id) personLabel;
  final VoidCallback onTap;
  final bool selected;
  final ValueChanged<bool?>? onSelected;

  const FileListItem({
    super.key,
    required this.file,
    required this.personLabel,
    required this.onTap,
    this.selected = false,
    this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final holder = file.currentHolderId;
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: ListTile(
        leading: Checkbox(value: selected, onChanged: onSelected),
        title: Text(
          file.name,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          holder == null
              ? '${file.number} · ${file.status.label}'
              : '${file.number} · 当前: ${personLabel(holder)}',
        ),
        trailing: _StatusChip(status: file.status),
        onTap: onTap,
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final FileStatus status;
  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (status) {
      FileStatus.pending => (Colors.green.shade100, Colors.green.shade900),
      FileStatus.processing => (Colors.blue.shade100, Colors.blue.shade900),
      FileStatus.completed => (Colors.grey.shade300, Colors.grey.shade800),
    };
    return Chip(
      label: Text(
        status.label,
        style: TextStyle(color: fg, fontWeight: FontWeight.w600),
      ),
      backgroundColor: bg,
    );
  }
}
