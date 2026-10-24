import 'package:flutter/material.dart';

import '../models/tracked_file.dart';

class FileDetailSheet extends StatelessWidget {
  final TrackedFile file;
  final String Function(String id) personLabel;
  final void Function(String action) onAction;

  const FileDetailSheet({
    super.key,
    required this.file,
    required this.personLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(file.name, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text('编号: ${file.number}'),
          if (file.remark != null) Text('备注: ${file.remark}'),
          const Divider(),
          _StatusRow(
            status: file.status,
            holder: file.currentHolderId == null
                ? null
                : personLabel(file.currentHolderId!),
          ),
          const SizedBox(height: 8),
          Text('交办记录', style: Theme.of(context).textTheme.titleSmall),
          ...file.handoffs.map(
            (h) => ListTile(
              dense: true,
              leading: CircleAvatar(
                radius: 16,
                child: Text(
                  h.toPersonId.substring(0, 2),
                  style: const TextStyle(fontSize: 10),
                ),
              ),
              title: Text(personLabel(h.toPersonId)),
              subtitle: Text(
                '交办: ${_fmt(h.assignedAt)}'
                '${h.completedAt == null ? '' : ' · 办结: ${_fmt(h.completedAt!)}'}',
              ),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => onAction('complete'),
            child: const Text('登记办结'),
          ),
          TextButton(
            onPressed: () => onAction('edit'),
            child: const Text('编辑名称/编号'),
          ),
          TextButton(
            onPressed: () => onAction('handoff'),
            child: const Text('交办给他人'),
          ),
          TextButton(
            onPressed: () => onAction('delete'),
            child: const Text('删除文件'),
          ),
        ],
      ),
    );
  }

  static String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')} '
      '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

class _StatusRow extends StatelessWidget {
  final FileStatus status;
  final String? holder;
  const _StatusRow({required this.status, this.holder});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Chip(
        label: Text(status.label),
        backgroundColor: switch (status) {
          FileStatus.pending => Colors.green.shade100,
          FileStatus.processing => Colors.blue.shade100,
          FileStatus.completed => Colors.grey.shade300,
        },
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          holder == null ? '无当前持有人' : '当前持有人: $holder',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ),
    ],
  );
}
