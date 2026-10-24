import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../models/tracked_file.dart';
import '../services/database_service.dart';

/// 新增/编辑文件页：以 bottom sheet 形式弹出。
/// 传 [initial] 时为编辑已有文件，否则为登记新文件。
/// 返回值：填写完成的 TrackedFile（未保存），由调用方持久化。
class RegisterFilePage extends StatefulWidget {
  final TrackedFile? initial;

  const RegisterFilePage({super.key, this.initial});

  @override
  State<RegisterFilePage> createState() => _RegisterFilePageState();
}

class _RegisterFilePageState extends State<RegisterFilePage> {
  final _formKey = GlobalKey<FormState>();
  late final _numberCtrl = TextEditingController(text: widget.initial?.number);
  late final _nameCtrl = TextEditingController(text: widget.initial?.name);
  late final _remarkCtrl = TextEditingController(
    text: widget.initial?.remark ?? '',
  );
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.initial == null) _previewNumber();
  }

  Future<void> _previewNumber() async {
    final number = await DatabaseService().generateNumber(DateTime.now());
    if (mounted) _numberCtrl.text = number;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    final remark = _remarkCtrl.text.trim();
    final file = TrackedFile(
      id: widget.initial?.id ?? const Uuid().v4(),
      number: _numberCtrl.text.trim(),
      name: _nameCtrl.text.trim(),
      registeredAt: widget.initial?.registeredAt ?? DateTime.now(),
      remark: remark.isEmpty ? null : remark,
      handoffs: widget.initial?.handoffs ?? [],
      completed: widget.initial?.completed ?? false,
    );
    if (mounted) Navigator.pop(context, file);
  }

  @override
  void dispose() {
    _numberCtrl.dispose();
    _nameCtrl.dispose();
    _remarkCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.initial == null ? '登记新文件' : '编辑文件',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _numberCtrl,
              decoration: const InputDecoration(labelText: '文件编号'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? '请输入文件编号' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _nameCtrl,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: '文件名',
                hintText: '例如：关于XX事项的通知',
              ),
              validator: (v) => v == null || v.trim().isEmpty ? '请输入文件名' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _remarkCtrl,
              decoration: const InputDecoration(labelText: '备注（可选）'),
              maxLines: 2,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: const Text('保存'),
            ),
          ],
        ),
      ),
    );
  }
}
