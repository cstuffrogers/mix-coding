import 'package:flutter_test/flutter_test.dart';

import 'package:file_handoff_app/models/tracked_file.dart';

void main() {
  test('file status follows handoff lifecycle', () {
    final file = TrackedFile(
      id: 'file-1',
      number: '20260101-01号文',
      name: '测试文件',
      registeredAt: DateTime(2026, 1, 1),
    );
    expect(file.status, FileStatus.pending);

    final handoff = Handoff(
      id: 'handoff-1',
      fromPersonId: '管理员',
      toPersonId: 'person-1',
      assignedAt: DateTime(2026, 1, 1, 9),
    );
    file.handoffs.add(handoff);
    expect(file.status, FileStatus.processing);
    expect(file.currentHolderId, 'person-1');

    handoff.completedAt = DateTime(2026, 1, 2, 17);
    expect(file.status, FileStatus.completed);
    expect(file.currentHolderId, isNull);
  });

  test('completed file can start a new handoff cycle', () {
    final file = TrackedFile(
      id: 'file-1',
      number: '20260101-01号文',
      name: '测试文件',
      registeredAt: DateTime(2026, 1, 1),
      handoffs: [
        Handoff(
          id: 'handoff-1',
          fromPersonId: '管理员',
          toPersonId: 'person-1',
          assignedAt: DateTime(2026, 1, 1),
          completedAt: DateTime(2026, 1, 2),
        ),
      ],
    );

    file.handoffs.add(Handoff(
      id: 'handoff-2',
      fromPersonId: 'person-1',
      toPersonId: 'person-2',
      assignedAt: DateTime(2026, 1, 3),
    ));

    expect(file.status, FileStatus.processing);
    expect(file.currentHolderId, 'person-2');
    expect(file.handoffs, hasLength(2));
  });
}