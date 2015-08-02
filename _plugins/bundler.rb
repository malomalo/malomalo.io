require "rubygems"
require "bundler/setup"
Bundler.require(:default)

module Jekyll
  module Utils
    def self.has_yaml_header?(file)
      if file =~ /\/_recipes\/.+/i
        true
      else
        !!(File.open(file, 'rb') { |f| f.read(5) } =~ /\A---\r?\n/)
      end
    end
  end
  
  class Document
    
    ATTRIBUTES_FOR_LIQUID = ['title']
    
    attr_accessor :date
    
    def data
      @data ||= {}
      
      if @collection.label == 'recipes'
        @data['title'] = File.basename(@path, @extname).split('-').map(&:capitalize).join(' ')
        @date ||= Utils.parse_date(`git log --format=%aD --follow -- #{relative_path[1..-1]} | tail -n 1`)
        @data['date'] = @date
      else
      end
      
      @data ||= Hash.new
    end
  end
  
end


module Jekyll
  module AssetFilter
    def concat(input, array)
      input.to_a.concat(array)
    end
  end
end

Liquid::Template.register_filter(Jekyll::AssetFilter)
