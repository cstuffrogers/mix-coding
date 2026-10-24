enum FileStatus {
  /// 已登记，尚未交办给任何人
  pending,

  /// 已交办，当前有人办理中
  processing,

  /// 当前办理周期已办结
  completed;
}

extension FileStatusLabel on FileStatus {
  String get label => switch (this) {
        FileStatus.pending => '待办',
        FileStatus.processing => '办理中',
        FileStatus.completed => '办结',
      };
}
