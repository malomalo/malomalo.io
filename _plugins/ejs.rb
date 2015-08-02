class Sprockets::JstProcessor

  def self.default_namespace
    'templates'
  end

  def evaluate(scope, locals, &block)
    "#{namespace}[#{scope.logical_path.inspect.sub('templates/','')}] = #{indent(data)};"
  end

end

EJS.evaluation_pattern = /\[\[([^\[].*?)\]\]/
EJS.interpolation_pattern = /\[\[\=(.+?)\]\]/
EJS.escape_pattern = /\[\[-([\s\S]+?)\]\]/
EJS.interpolation_with_subtemplate_pattern = %r{
  \[\[=(?<start>(?:(?!\]\])[\s\S])+\{)\s*\]\]
  (?<middle>
  (
    (?<re>
      \[\[=?(?:(?!\]\])[\s\S])+\{\s*\]\]
      (?:
        \[\[\s*\}(?:(?!\{\s*\]\])[\s\S])+\{\s*\]\]
        |
        \g<re>
        |
        .{1}
      )*?
      \[\[\s*\}[^\{]+?\]\]
    )
    |
    .{1}
  )*?
  )
  \[\[\s*(?<end>\}[\s\S]+?)\]\]
}xm