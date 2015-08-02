require "rubygems"
require "bundler/setup"
Bundler.require(:default)

module Jekyll
  module Utils
    def self.has_yaml_header?(file)
      if File.basename(file).end_with?('.mdown')
        true
      else
        !!(File.open(file, 'rb') { |f| f.read(5) } =~ /\A---\r?\n/)
      end
    end
  end
  
  class Page
    
    attr_accessor :main
    
    def data
      if name.end_with?('.mdown')
        @data ||= {}
        @data['title'] = basename.split('-').map(&:capitalize).join(' ')
        @data['layout'] = 'recipe'
        @data['recipe'] = true
      end
      @data
    end
    
    def recipe
      !!@data['recipe']
    end
  end
  
end

Jekyll::Page::ATTRIBUTES_FOR_LIQUID << 'recipe' << 'main'

# g log --format=%aD --follow -- taco-soup.mdown