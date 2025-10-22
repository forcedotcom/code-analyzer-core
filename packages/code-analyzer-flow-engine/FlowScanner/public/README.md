The [public](public) module contains the interfaces and libraries that queries can develop against.

It must be completely self-contained. Nothing in this module can import from the rest
of the project.

Once the project reaches 1.0 release status, 
nothing in this module should change. If you are importing from this
module and need to change a method, make a local version in your own module or in [flow_scanner.util](flow_scanner.util)
and leave the public version as is.  This is important for existing queries to be able to run
even across version upgrades.

