import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EndpointTable } from './endpoint-table';

describe('EndpointTable', () => {
  let component: EndpointTable;
  let fixture: ComponentFixture<EndpointTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EndpointTable]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EndpointTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
